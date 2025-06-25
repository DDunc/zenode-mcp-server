/**
 * Redis-based Conversation Logger
 * 
 * This replaces the middleware-based conversation logger with a Redis-backed
 * system that saves conversation continuation IDs and writes them to local folders.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { createClient } from 'redis';
import { logger } from './logger.js';
import { REDIS_URL } from '../config.js';

type RedisClient = ReturnType<typeof createClient>;

export interface ConversationLogEntry {
  timestamp: string;
  requestId: string;
  toolName: string;
  conversationId?: string;
  phase: 'request' | 'response';
  data: {
    input?: any;
    output?: any;
    error?: string;
    duration?: number;
    model_used?: string;
    token_usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  };
}

export interface ConversationMetadata {
  id: string;
  started: string;
  lastActivity: string;
  toolsUsed: string[];
  triggerPattern: string;
  entryCount: number;
}

export class RedisConversationLogger {
  private redis: RedisClient | null = null;
  private logDirectory: string;
  private isEnabled: boolean;
  
  // Tool emojis for better visual identification
  private static TOOL_EMOJIS = {
    'chat': '💬',
    'analyze': '🔍', 
    'thinkdeep': '🧠',
    'debug': '🐛',
    'codereview': '👀',
    'precommit': '🔒',
    'testgen': '🧪',
    'gopher': '🐹',
    'config': '⚙️',
    'bootstrap': '🚀',
    'grunts': '⚡'
  } as const;

  constructor(
    redisUrl: string = REDIS_URL,
    logDirectory: string = './conversation-logs',
    enabled: boolean = true
  ) {
    this.logDirectory = logDirectory;
    this.isEnabled = enabled;
    
    if (!this.isEnabled) {
      logger.info('Redis conversation logger is disabled - skipping Redis client creation');
      return; // Don't create Redis client when disabled
    }
    
    this.redis = createClient({ url: redisUrl });
    
    this.redis.on('error', (error: Error) => {
      logger.error('Redis conversation logger error:', error);
    });
    
    this.redis.on('reconnecting', () => {
      logger.warn('Redis Client Reconnecting');
    });
    
    // Connect to Redis with retry logic
    this.connectWithRetry();
  }

  /**
   * Connect to Redis with exponential backoff retry
   */
  private async connectWithRetry(maxRetries: number = 10): Promise<void> {
    if (!this.redis) {
      logger.warn('Redis conversation logger: No Redis client to connect (disabled)');
      return;
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.redis.connect();
        logger.info(`✅ Redis conversation logger connected successfully on attempt ${attempt}`);
        return;
      } catch (error) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
        logger.warn(`Redis conversation logger attempt ${attempt}/${maxRetries} failed, retrying in ${waitTime}ms...`);
        
        if (attempt === maxRetries) {
          logger.error('❌ Redis conversation logger failed after all retries. Conversation logging disabled.');
          this.isEnabled = false;
          return;
        }
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  /**
   * Check if a request should be logged based on trigger patterns
   */
  private shouldLog(input: any): boolean {
    if (!this.isEnabled) return false;

    // Look for :z trigger pattern
    const prompt = input?.prompt || input?.message || input?.content || JSON.stringify(input);
    if (typeof prompt === 'string') {
      return prompt.includes(':z') || prompt.startsWith(':z');
    }

    return false;
  }

  /**
   * Log a tool request
   */
  async logRequest(
    requestId: string,
    toolName: string,
    input: any,
    conversationId?: string
  ): Promise<void> {
    if (!this.shouldLog(input)) return;

    const entry: ConversationLogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      toolName,
      conversationId,
      phase: 'request',
      data: { input }
    };

    await this.storeEntry(entry);
    logger.debug(`[CONVERSATION_LOG] Logged request: ${toolName} (${requestId})`);
  }

  /**
   * Log a tool response
   */
  async logResponse(
    requestId: string,
    toolName: string,
    output: any,
    error?: Error,
    duration?: number,
    conversationId?: string
  ): Promise<void> {
    if (!this.redis || !this.isEnabled) {
      return; // Skip if Redis is not available or disabled
    }
    
    // Check if we have a corresponding request
    const requestKey = `zenode:conversation:request:${requestId}`;
    const hasRequest = await this.redis.exists(requestKey);
    
    if (!hasRequest) return; // Only log responses that have corresponding requests

    const entry: ConversationLogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      toolName,
      conversationId,
      phase: 'response',
      data: {
        output,
        error: error?.message,
        duration,
        model_used: output?.metadata?.model_used,
        token_usage: output?.metadata?.token_usage
      }
    };

    await this.storeEntry(entry);
    
    // Write complete conversation entry to local file
    await this.writeConversationToFile(requestId, conversationId);
    
    logger.debug(`[CONVERSATION_LOG] Logged response: ${toolName} (${requestId})`);
  }

  /**
   * Store entry in Redis
   */
  private async storeEntry(entry: ConversationLogEntry): Promise<void> {
    if (!this.redis || !this.isEnabled) {
      return; // Skip if Redis is not available or disabled
    }
    
    const entryKey = `zenode:conversation:${entry.phase}:${entry.requestId}`;
    const conversationKey = `zenode:conversation:meta:${entry.conversationId || 'default'}`;
    
    // Store the entry
    await this.redis.setEx(entryKey, 86400, JSON.stringify(entry)); // 24 hour expiry
    
    // Update conversation metadata
    if (entry.conversationId) {
      if (entry.phase === 'request') {
        // Add tool to tools used list
        await this.redis.sAdd(`${conversationKey}:tools`, entry.toolName);
        
        // Set/update started timestamp
        const exists = await this.redis.exists(conversationKey);
        if (!exists) {
          await this.redis.hSet(conversationKey, 'started', entry.timestamp);
        }
      }
      
      // Update metadata
      await this.redis.hSet(conversationKey, {
        id: entry.conversationId,
        lastActivity: entry.timestamp,
        triggerPattern: ':z'
      });
      await this.redis.expire(conversationKey, 86400); // 24 hour expiry
    }
  }

  /**
   * Write complete conversation entry to local file
   */
  private async writeConversationToFile(
    requestId: string,
    conversationId?: string
  ): Promise<void> {
    try {
      // Get request and response entries
      const requestKey = `zenode:conversation:request:${requestId}`;
      const responseKey = `zenode:conversation:response:${requestId}`;
      
      if (!this.redis) return;
      
      const [requestData, responseData] = await Promise.all([
        this.redis.get(requestKey),
        this.redis.get(responseKey)
      ]);

      if (!requestData || !responseData) return;

      const request: ConversationLogEntry = JSON.parse(requestData);
      const response: ConversationLogEntry = JSON.parse(responseData);

      // Ensure log directory exists
      await this.ensureLogDirectory();

      // Determine filename
      const date = new Date().toISOString().split('T')[0];
      const filename = conversationId 
        ? `conversation-${conversationId}.md`
        : `zenode-${date}-${requestId}.md`;
      
      const filepath = join(this.logDirectory, filename);

      // Format as markdown
      const markdownEntry = this.formatMarkdownEntry(request, response);

      // Check if this is the first entry in the conversation
      let fileExists = false;
      try {
        await fs.access(filepath);
        fileExists = true;
      } catch {
        // File doesn't exist
      }

      if (fileExists) {
        // Append to existing conversation
        await fs.appendFile(filepath, '\n' + markdownEntry, 'utf8');
      } else {
        // Create new conversation file with header
        const header = await this.createConversationHeader(conversationId);
        await fs.writeFile(filepath, header + markdownEntry, 'utf8');
      }

      logger.info(`[CONVERSATION_LOG] Written to file: ${filename}`);

    } catch (error) {
      logger.error('[CONVERSATION_LOG] Failed to write to file:', error);
    }
  }

  /**
   * Create conversation file header with metadata
   */
  private async createConversationHeader(conversationId?: string): Promise<string> {
    const now = new Date();
    let toolsUsed: string[] = [];

    if (conversationId && this.redis) {
      const metaKey = `zenode:conversation:meta:${conversationId}:tools`;
      toolsUsed = await this.redis.sMembers(metaKey);
    }

    const frontmatter = `---
conversation_id: "${conversationId || 'unknown'}"
started: "${now.toISOString()}"
date: "${now.toLocaleDateString()}"
time: "${now.toLocaleTimeString()}"
trigger: ":z"
tools_used: [${toolsUsed.map(t => `"${t}"`).join(', ')}]
coordination: ${toolsUsed.length > 1}
format_version: "2.0"
logger: "redis-conversation-logger"
---

# 🤖 Zenode Conversation

> **Started:** ${now.toLocaleString()} | **Trigger:** \`:z\` | **Tools:** ${toolsUsed.length}

`;
    
    return frontmatter;
  }

  /**
   * Format conversation entry as markdown
   */
  private formatMarkdownEntry(
    request: ConversationLogEntry,
    response: ConversationLogEntry
  ): string {
    const toolEmoji = RedisConversationLogger.TOOL_EMOJIS[
      request.toolName as keyof typeof RedisConversationLogger.TOOL_EMOJIS
    ] || '🔧';
    
    const toolName = request.toolName.toUpperCase();
    const timestamp = new Date(response.timestamp).toLocaleString();
    const duration = response.data.duration 
      ? `${(response.data.duration / 1000).toFixed(1)}s` 
      : 'N/A';

    let entry = `## ${toolEmoji} **${toolName}** (${duration})\n\n`;

    // Format input
    const input = request.data.input;
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

    // Format output
    const output = response.data.output;
    const error = response.data.error;

    if (error) {
      entry += `❌ **Error:**\n\`\`\`\n${error}\n\`\`\`\n\n`;
    } else if (output) {
      if (typeof output === 'string') {
        entry += `${output}\n\n`;
      } else if (output.content) {
        entry += `${output.content}\n\n`;
        
        // Add metadata if available
        if (output.metadata || response.data.model_used || response.data.token_usage) {
          entry += `<details><summary>📊 Metadata</summary>\n\n`;
          
          if (response.data.model_used) {
            entry += `- **Model:** ${response.data.model_used}\n`;
          }
          
          if (response.data.token_usage) {
            const tokens = response.data.token_usage;
            entry += `- **Tokens:** ${tokens.inputTokens} in, ${tokens.outputTokens} out\n`;
          }
          
          if (output.metadata) {
            entry += `- **Additional:** ${JSON.stringify(output.metadata, null, 2)}\n`;
          }
          
          entry += `\n</details>\n\n`;
        }
      } else {
        entry += `<details><summary>📋 Raw Output</summary>\n\n\`\`\`json\n${JSON.stringify(output, null, 2)}\n\`\`\`\n\n</details>\n\n`;
      }
    }

    entry += `---\n`;
    return entry;
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.access(this.logDirectory);
    } catch {
      await fs.mkdir(this.logDirectory, { recursive: true });
    }
  }

  /**
   * Get conversation metadata
   */
  async getConversationMetadata(conversationId: string): Promise<ConversationMetadata | null> {
    if (!this.redis || !this.isEnabled) {
      return null; // Redis not available or disabled
    }
    
    const metaKey = `zenode:conversation:meta:${conversationId}`;
    const toolsKey = `${metaKey}:tools`;
    
    const [metadata, toolsUsed] = await Promise.all([
      this.redis.hGetAll(metaKey),
      this.redis.sMembers(toolsKey)
    ]);

    if (!metadata.id) return null;

    return {
      id: metadata.id || '',
      started: metadata.started || '',
      lastActivity: metadata.lastActivity || '',
      toolsUsed,
      triggerPattern: metadata.triggerPattern || ':z',
      entryCount: toolsUsed.length
    };
  }

  /**
   * List recent conversations
   */
  async listRecentConversations(limit: number = 10): Promise<ConversationMetadata[]> {
    if (!this.redis || !this.isEnabled) {
      return []; // Redis not available or disabled
    }
    
    const keys = await this.redis.keys('zenode:conversation:meta:*');
    const conversations: ConversationMetadata[] = [];

    for (const key of keys.slice(0, limit)) {
      const conversationId = key.split(':').pop();
      if (conversationId && !conversationId.includes(':')) {
        const metadata = await this.getConversationMetadata(conversationId);
        if (metadata) {
          conversations.push(metadata);
        }
      }
    }

    // Sort by last activity
    return conversations.sort((a, b) => 
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.disconnect();
    }
  }
}

// Create singleton instance - check for Redis disable flags
const isRedisEnabled = process.env.DISABLE_ALL_REDIS !== 'true';
export const redisConversationLogger = new RedisConversationLogger(
  process.env.REDIS_URL || 'redis://localhost:6380/0',
  './conversation-logs', 
  isRedisEnabled
);