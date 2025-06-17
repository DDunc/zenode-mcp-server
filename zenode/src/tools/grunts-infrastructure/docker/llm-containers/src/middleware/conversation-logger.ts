import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { Middleware, MiddlewareConfig, MiddlewarePhase, ToolContext } from './types.js';
import { configLoader } from '../config/loader.js';

export interface ConversationLoggerConfig extends MiddlewareConfig {
  logPath: string;
  enabled: boolean;
  format: 'json' | 'markdown';
}

export interface ConversationLogEntry {
  timestamp: string;
  requestId: string;
  toolName: string;
  phase: 'request' | 'response';
  conversationId?: string;
  userId?: string;
  data: {
    input?: any;
    output?: any;
    error?: string;
    duration?: number;
  };
}

export class ConversationLoggerMiddleware implements Middleware {
  config: ConversationLoggerConfig;
  private requestTimestamps = new Map<string, number>();
  private conversationLogs = new Map<string, ConversationLogEntry[]>();

  // Tool emojis for better visual identification
  private static TOOL_EMOJIS = {
    'chat': '💬',
    'analyze': '🔍', 
    'thinkdeep': '🧠',
    'debug': '🐛',
    'codereview': '👀',
    'precommit': '🔒',
    'testgen': '🧪',
    'gopher': '🐹'
  };

  constructor(config: Partial<ConversationLoggerConfig> = {}) {
    const loggingConfig = configLoader.getLoggingConfig();
    this.config = {
      name: 'conversation-logger',
      phases: MiddlewarePhase.BOTH,
      enabled: loggingConfig.enabled,
      logPath: loggingConfig.logPath,
      format: loggingConfig.format || 'markdown',
      ...config
    };
  }

  private shouldLog(context: ToolContext): boolean {
    const loggingConfig = configLoader.getLoggingConfig();
    
    // Check if logging is enabled in config
    if (!loggingConfig.enabled) {
      return false;
    }
    
    console.log('MIDDLEWARE: shouldLog called for tool:', context.toolName);
    console.log('MIDDLEWARE: input keys:', context.input ? Object.keys(context.input) : 'no input');
    console.log('MIDDLEWARE: trigger pattern:', loggingConfig.conversationTrigger);
    
    // Check if the input contains the configured trigger pattern
    if (context.input && typeof context.input === 'object') {
      // Look for the original prompt in various possible locations
      const prompt = context.input.prompt || 
                    context.input.message || 
                    context.input.content ||
                    JSON.stringify(context.input);
      
      console.log('MIDDLEWARE: extracted prompt:', JSON.stringify(prompt).substring(0, 100));
      
      if (typeof prompt === 'string') {
        const hasTrigger = prompt.includes(loggingConfig.conversationTrigger);
        console.log('MIDDLEWARE: contains trigger?', hasTrigger);
        return hasTrigger;
      }
    }
    
    console.log('MIDDLEWARE: returning false (no valid prompt found)');
    return false;
  }

  async onRequest(context: ToolContext): Promise<void> {
    console.log('MIDDLEWARE: onRequest called for tool:', context.toolName);
    console.log('MIDDLEWARE: shouldLog result:', this.shouldLog(context));
    if (!this.shouldLog(context)) return;

    this.requestTimestamps.set(context.requestId, Date.now());
    
    const logEntry: ConversationLogEntry = {
      timestamp: context.timestamp.toISOString(),
      requestId: context.requestId,
      toolName: context.toolName,
      phase: 'request',
      conversationId: context.conversationId,
      userId: context.userId,
      data: {
        input: context.input
      }
    };

    await this.writeLog(logEntry);
  }

  async onResponse(context: ToolContext, result: any, error?: Error): Promise<void> {
    if (!this.shouldLog(context)) return;

    const startTime = this.requestTimestamps.get(context.requestId);
    const duration = startTime ? Date.now() - startTime : undefined;
    this.requestTimestamps.delete(context.requestId);

    const logEntry: ConversationLogEntry = {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      toolName: context.toolName,
      phase: 'response',
      conversationId: context.conversationId,
      userId: context.userId,
      data: {
        output: result,
        error: error?.message,
        duration
      }
    };

    await this.writeLog(logEntry);
  }

  private async writeLog(entry: ConversationLogEntry): Promise<void> {
    try {
      await this.ensureLogDirectory();

      if (this.config.format === 'markdown') {
        await this.writeMarkdownLog(entry);
      } else {
        await this.writeJsonLog(entry);
      }
    } catch (error) {
      console.error('Failed to write conversation log:', error);
    }
  }

  private async writeJsonLog(entry: ConversationLogEntry): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const filename = `${date}-${entry.requestId}-${entry.phase}.json`;
    const filepath = join(this.config.logPath, filename);
    await fs.writeFile(filepath, JSON.stringify(entry, null, 2), 'utf8');
  }

  private async writeMarkdownLog(entry: ConversationLogEntry): Promise<void> {
    // Group by conversation ID or date if no conversation ID
    const conversationKey = entry.conversationId || entry.timestamp.split('T')[0] || 'unknown';
    const filename = `conversation-${conversationKey}.md`;
    const filepath = join(this.config.logPath, filename);

    // Store the entry for potential pairing
    if (!this.conversationLogs.has(conversationKey)) {
      this.conversationLogs.set(conversationKey, []);
    }
    this.conversationLogs.get(conversationKey)!.push(entry);

    // If this is a response, try to pair with request
    if (entry.phase === 'response') {
      await this.writeConversationEntry(filepath, conversationKey);
    }
  }

  private async writeConversationEntry(filepath: string, conversationKey: string): Promise<void> {
    const entries = this.conversationLogs.get(conversationKey) || [];
    const lastResponse = entries[entries.length - 1];
    
    if (!lastResponse || lastResponse.phase !== 'response') return;

    // Find the matching request
    const matchingRequest = entries.find(e => 
      e.requestId === lastResponse.requestId && e.phase === 'request'
    );

    if (!matchingRequest) return;

    const toolEmoji = ConversationLoggerMiddleware.TOOL_EMOJIS[lastResponse.toolName as keyof typeof ConversationLoggerMiddleware.TOOL_EMOJIS] || '🔧';
    const toolName = lastResponse.toolName.toUpperCase();
    const timestamp = new Date(lastResponse.timestamp).toLocaleString();
    const duration = lastResponse.data.duration ? `${(lastResponse.data.duration / 1000).toFixed(1)}s` : 'N/A';

    // Format the conversation entry
    const conversationEntry = this.formatMarkdownEntry({
      toolEmoji,
      toolName,
      timestamp,
      duration,
      input: matchingRequest.data.input,
      output: lastResponse.data.output,
      error: lastResponse.data.error
    });

    // Append to the conversation file
    try {
      await fs.access(filepath);
      // File exists, append
      await fs.appendFile(filepath, '\n' + conversationEntry, 'utf8');
    } catch {
      // File doesn't exist, create with header and frontmatter
      const header = this.createConversationHeader(conversationKey);
      await fs.writeFile(filepath, header + conversationEntry, 'utf8');
    }
  }

  private createConversationHeader(conversationKey: string): string {
    const now = new Date();
    const entries = this.conversationLogs.get(conversationKey) || [];
    const toolsUsed = [...new Set(entries.map(e => e.toolName))];
    
    // Create YAML frontmatter
    const frontmatter = `---
conversation_id: "${conversationKey || 'unknown'}"
started: "${now.toISOString()}"
date: "${now.toLocaleDateString() || 'unknown'}"
time: "${now.toLocaleTimeString() || 'unknown'}"
trigger: ":z"
tools_used: [${toolsUsed.map(t => `"${t}"`).join(', ')}]
coordination: ${toolsUsed.length > 1}
format_version: "1.0"
---

# 🤖 Zenode Conversation

> **Started:** ${now.toLocaleString() || 'unknown'} | **Trigger:** \`:z\` | **Tools:** ${toolsUsed.length}

`;
    
    return frontmatter;
  }

  private formatMarkdownEntry(data: {
    toolEmoji: string;
    toolName: string;
    timestamp: string;
    duration: string;
    input: any;
    output: any;
    error?: string;
  }): string {
    const { toolEmoji, toolName, timestamp, duration, input, output, error } = data;

    let entry = `## ${toolEmoji} **${toolName}** (${duration})\n\n`;

    // Format input - more compact
    if (input) {
      if (input.prompt) {
        entry += `> **Input:** ${input.prompt}\n\n`;
      }
      if (input.files && input.files.length > 0) {
        entry += `> **Files:** ${input.files.join(', ')}\n\n`;
      }
      if (input.model && input.model !== 'auto') {
        entry += `> **Model:** ${input.model}\n\n`;
      }
    }

    // Format output - cleaner presentation
    if (error) {
      entry += `❌ **Error:**\n\`\`\`\n${error}\n\`\`\`\n\n`;
    } else if (output) {
      if (typeof output === 'string') {
        entry += `${output}\n\n`;
      } else if (output.content) {
        entry += `${output.content}\n\n`;
        if (output.metadata) {
          entry += `<details><summary>📊 Metadata</summary>\n\n`;
          entry += `- **Model:** ${output.metadata.model_used}\n`;
          entry += `- **Tokens:** ${output.metadata.token_usage?.inputTokens || 0} in, ${output.metadata.token_usage?.outputTokens || 0} out\n`;
          entry += `\n</details>\n\n`;
        }
      } else {
        entry += `<details><summary>📋 Raw Output</summary>\n\n\`\`\`json\n${JSON.stringify(output, null, 2)}\n\`\`\`\n\n</details>\n\n`;
      }
    }

    entry += `---\n`;
    return entry;
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.access(this.config.logPath);
    } catch {
      // Directory doesn't exist, create it (and parent directories)
      await fs.mkdir(this.config.logPath, { recursive: true });
    }
  }
}