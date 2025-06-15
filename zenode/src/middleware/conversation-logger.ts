import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { Middleware, MiddlewareConfig, MiddlewarePhase, ToolContext } from './types.js';
import { configLoader } from '../config/loader.js';

export interface ConversationLoggerConfig extends MiddlewareConfig {
  logPath: string;
  enabled: boolean;
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

  constructor(config: Partial<ConversationLoggerConfig> = {}) {
    const loggingConfig = configLoader.getLoggingConfig();
    this.config = {
      name: 'conversation-logger',
      phases: MiddlewarePhase.BOTH,
      enabled: loggingConfig.enabled,
      logPath: loggingConfig.logPath,
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
      // Ensure the log directory exists
      await this.ensureLogDirectory();

      // Create filename based on date and request ID
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `${date}-${entry.requestId}-${entry.phase}.json`;
      const filepath = join(this.config.logPath, filename);

      // Write the log entry
      await fs.writeFile(filepath, JSON.stringify(entry, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to write conversation log:', error);
    }
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