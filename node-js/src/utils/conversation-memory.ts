/**
 * Conversation memory management using Redis
 *
 * This module handles persistent conversation threading across tool calls,
 * allowing AI tools to maintain context when users continue conversations.
 */

import { createClient, RedisClientType } from 'redis';
import { REDIS_URL } from '../config.js';
import { logger } from './logger.js';
import { ConversationThread, ConversationTurn, ConversationStats } from '../types/tools.js';

// Redis client instance
let redisClient: RedisClientType | null = null;

// Constants
export const MAX_CONVERSATION_TURNS = 20;
const CONVERSATION_TTL = 86400; // 24 hours in seconds
const KEY_PREFIX = 'zenode:conversation:';

/**
 * Initialize Redis connection
 */
export async function initializeRedis(): Promise<void> {
  if (redisClient) {
    return; // Already initialized
  }

  try {
    redisClient = createClient({
      url: REDIS_URL,
    });

    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    redisClient.on('connect', () => logger.info('Redis Client Connected'));
    redisClient.on('ready', () => logger.info('Redis Client Ready'));
    redisClient.on('reconnecting', () => logger.warn('Redis Client Reconnecting'));

    await redisClient.connect();
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Continue without Redis - conversations won't persist
    redisClient = null;
  }
}

/**
 * Create a new conversation thread
 */
export async function createThread(toolName: string, modelName: string): Promise<string> {
  const threadId = generateThreadId();
  const thread: ConversationThread = {
    thread_id: threadId,
    created_at: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    turns: [],
    metadata: {
      tools_used: [toolName],
      total_input_tokens: 0,
      total_output_tokens: 0,
    },
  };

  if (redisClient) {
    try {
      const key = `${KEY_PREFIX}${threadId}`;
      await redisClient.setEx(key, CONVERSATION_TTL, JSON.stringify(thread));
    } catch (error) {
      logger.error('Failed to create thread in Redis:', error);
    }
  }

  return threadId;
}

/**
 * Get an existing conversation thread
 */
export async function getThread(threadId: string): Promise<ConversationThread | null> {
  if (!redisClient) {
    return null;
  }

  try {
    const key = `${KEY_PREFIX}${threadId}`;
    const data = await redisClient.get(key);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data) as ConversationThread;
  } catch (error) {
    logger.error('Failed to get thread from Redis:', error);
    return null;
  }
}

/**
 * Add a turn to a conversation thread
 */
export async function addTurn(
  threadId: string,
  role: 'user' | 'assistant',
  content: string,
  modelName?: string,
  inputTokens: number = 0,
  outputTokens: number = 0,
): Promise<void> {
  if (!redisClient) {
    return;
  }

  try {
    const thread = await getThread(threadId);
    if (!thread) {
      logger.warn(`Thread ${threadId} not found, cannot add turn`);
      return;
    }

    // Add the new turn
    const turn: ConversationTurn = {
      role,
      content,
      model: modelName,
      timestamp: new Date().toISOString(),
    };
    thread.turns.push(turn);

    // Update metadata
    thread.last_updated = new Date().toISOString();
    thread.metadata.total_input_tokens += inputTokens;
    thread.metadata.total_output_tokens += outputTokens;

    // Trim old turns if necessary
    if (thread.turns.length > MAX_CONVERSATION_TURNS) {
      thread.turns = thread.turns.slice(-MAX_CONVERSATION_TURNS);
    }

    // Save back to Redis
    const key = `${KEY_PREFIX}${threadId}`;
    await redisClient.setEx(key, CONVERSATION_TTL, JSON.stringify(thread));
  } catch (error) {
    logger.error('Failed to add turn to thread:', error);
  }
}

/**
 * Get conversation statistics
 */
export async function getConversationStats(threadId: string): Promise<ConversationStats | null> {
  const thread = await getThread(threadId);
  if (!thread) {
    return null;
  }

  const modelsUsed = new Set<string>();
  thread.turns.forEach((turn) => {
    if (turn.model) {
      modelsUsed.add(turn.model);
    }
  });

  return {
    total_turns: thread.turns.length,
    total_input_tokens: thread.metadata.total_input_tokens,
    total_output_tokens: thread.metadata.total_output_tokens,
    models_used: Array.from(modelsUsed),
  };
}

/**
 * Reconstruct thread context for continuation
 * This is called when a tool receives a continuation_id
 */
export async function reconstructThreadContext(
  args: Record<string, any>,
): Promise<Record<string, any>> {
  const continuationId = args.continuation_id as string;
  const thread = await getThread(continuationId);

  if (!thread) {
    logger.warn(`Thread ${continuationId} not found, proceeding without context`);
    return args;
  }

  // Inject conversation history into the request
  const conversationContext = thread.turns
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join('\n\n');

  // Return modified args with injected context
  return {
    ...args,
    _conversation_context: conversationContext,
    _thread_metadata: thread.metadata,
    _remaining_tokens: calculateRemainingTokens(thread),
  };
}

/**
 * Get a list of files mentioned in the conversation
 */
export function getConversationFileList(thread: ConversationThread): string[] {
  const files = new Set<string>();
  
  // Extract file paths from conversation
  // This is a simplified implementation - could be enhanced with better parsing
  thread.turns.forEach((turn) => {
    const fileMatches = turn.content.match(/[\/\\][\w\-\/\\]+\.\w+/g);
    if (fileMatches) {
      fileMatches.forEach((file) => files.add(file));
    }
  });

  return Array.from(files);
}

/**
 * Generate a unique thread ID
 */
function generateThreadId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Calculate remaining tokens for a thread
 */
function calculateRemainingTokens(thread: ConversationThread): number {
  // This is a simplified calculation
  // In production, this should use actual token counting
  const MAX_CONTEXT_TOKENS = 100000; // Example limit
  const usedTokens = thread.metadata.total_input_tokens + thread.metadata.total_output_tokens;
  return Math.max(0, MAX_CONTEXT_TOKENS - usedTokens);
}

// Initialize Redis on module load
initializeRedis().catch((error) => {
  logger.error('Failed to initialize Redis on module load:', error);
});