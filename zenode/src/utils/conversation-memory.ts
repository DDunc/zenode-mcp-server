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
import { ModelContext } from './model-context.js';
import { estimateFileTokens, readFileContent } from './file-utils.js';

// Redis client instance
let redisClient: RedisClientType | null = null;

// Constants
export const MAX_CONVERSATION_TURNS = 20;
const CONVERSATION_TTL = 10800; // 3 hours in seconds (increased from 24h for better performance)
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
    id: threadId,
    thread_id: threadId,
    tool_name: toolName,
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
  options?: {
    modelName?: string;
    inputTokens?: number;
    outputTokens?: number;
    files?: string[];
    tool?: string;
  },
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
      model: options?.modelName,
      timestamp: new Date().toISOString(),
      tool: options?.tool,
      files: options?.files,
    };
    thread.turns.push(turn);

    // Update metadata
    thread.last_updated = new Date().toISOString();
    thread.metadata.total_input_tokens += options?.inputTokens || 0;
    thread.metadata.total_output_tokens += options?.outputTokens || 0;

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
 * Build formatted conversation history for tool prompts with embedded file contents.
 *
 * Creates a comprehensive conversation history that includes both conversation turns and
 * file contents, with intelligent prioritization to maximize relevant context within
 * token limits. This function enables stateless tools to access complete conversation
 * context from previous interactions, including cross-tool continuations.
 *
 * FILE PRIORITIZATION BEHAVIOR:
 * Files from newer conversation turns are prioritized over files from older turns.
 * When the same file appears in multiple turns, the reference from the NEWEST turn
 * takes precedence. This ensures the most recent file context is preserved when
 * token limits require file exclusions.
 *
 * TOKEN MANAGEMENT:
 * - Uses model-specific token allocation (file_tokens + history_tokens)
 * - Files are embedded ONCE at the start to prevent duplication
 * - Conversation turns are processed newest-first but presented chronologically
 * - Stops adding turns when token budget would be exceeded
 * - Gracefully handles token limits with informative notes
 */
export async function buildConversationHistory(
  thread: ConversationThread,
  modelContext: ModelContext,
): Promise<{ history: string; tokens: number }> {
  logger.debug(`[CONVERSATION_DEBUG] Building conversation history for thread ${thread.id}`);
  logger.debug(`[CONVERSATION_DEBUG] Thread has ${thread.turns.length} turns, tool: ${thread.tool_name}`);
  logger.debug(`[CONVERSATION_DEBUG] Using model: ${modelContext.modelName}`);

  const allocation = await modelContext.calculateTokenAllocation();
  const maxHistoryTokens = allocation.historyTokens;
  const maxFileTokens = allocation.fileTokens || Math.floor(allocation.contentTokens * 0.7); // 70% for files

  logger.debug(`[CONVERSATION_DEBUG] Max history tokens: ${maxHistoryTokens.toLocaleString()}`);
  logger.debug(`[CONVERSATION_DEBUG] Max file tokens: ${maxFileTokens.toLocaleString()}`);

  const historyParts: string[] = [];
  
  // Add conversation header
  historyParts.push('=== CONVERSATION HISTORY (CONTINUATION) ===');
  historyParts.push(`Thread: ${thread.id}`);
  historyParts.push(`Tool: ${thread.tool_name}`);
  historyParts.push(`Turn ${thread.turns.length}/${MAX_CONVERSATION_TURNS}`);
  historyParts.push('You are continuing this conversation thread from where it left off.');
  historyParts.push('');

  // Get all files referenced in this conversation with newest-first prioritization
  const allFiles = getConversationFileList(thread);
  
  // Embed files referenced in this conversation with size-aware selection
  if (allFiles.length > 0) {
    logger.debug(`[FILES] Starting embedding for ${allFiles.length} files`);

    // Plan file inclusion based on size constraints
    // CRITICAL: allFiles is already ordered by newest-first prioritization from getConversationFileList()
    // So when planFileInclusionBySize() hits token limits, it naturally excludes OLDER files first
    // while preserving the most recent file references - exactly what we want!
    const { filesToInclude, filesToSkip, estimatedTotalTokens } = await planFileInclusionBySize(allFiles, maxFileTokens);

    if (filesToSkip.length > 0) {
      logger.info(`[FILES] Skipping ${filesToSkip.length} files due to size constraints: ${filesToSkip.join(', ')}`);
    }

    if (filesToInclude.length > 0) {
      historyParts.push('=== FILES REFERENCED IN THIS CONVERSATION ===');
      historyParts.push('The following files have been shared and analyzed during our conversation.');
      if (filesToSkip.length > 0) {
        historyParts.push(`[NOTE: ${filesToSkip.length} files omitted due to size constraints]`);
      }
      historyParts.push('Refer to these when analyzing the context and requests below:');
      historyParts.push('');

      // Process files for embedding
      let actualFileTokens = 0;
      let filesIncluded = 0;

      for (const filePath of filesToInclude) {
        try {
          logger.debug(`[FILES] Processing file ${filePath}`);
          const { content: formattedContent, tokens: contentTokens } = await readFileContent(filePath);
          if (formattedContent) {
            historyParts.push(formattedContent);
            actualFileTokens += contentTokens;
            filesIncluded++;
            logger.debug(
              `File embedded in conversation history: ${filePath} (${contentTokens.toLocaleString()} tokens)`,
            );
          } else {
            logger.debug(`File skipped (empty content): ${filePath}`);
          }
        } catch (error) {
          logger.warn(
            `Failed to embed file in conversation history: ${filePath} - ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          continue;
        }
      }

      if (filesIncluded > 0) {
        if (filesToSkip.length > 0) {
          historyParts.push('');
          historyParts.push(
            `[NOTE: ${filesToSkip.length} additional file(s) were omitted due to size constraints. ` +
            'These were older files from earlier conversation turns.]',
          );
        }
        logger.debug(
          `Conversation history file embedding complete: ${filesIncluded} files embedded, ${filesToSkip.length} omitted, ${actualFileTokens.toLocaleString()} total tokens`,
        );
      } else {
        historyParts.push('(No accessible files found)');
        logger.debug(`[FILES] No accessible files found from ${filesToInclude.length} planned files`);
      }

      historyParts.push('');
      historyParts.push('=== END REFERENCED FILES ===');
      historyParts.push('');
    }
  }

  historyParts.push('Previous conversation turns:');
  historyParts.push('');

  // Process turns in reverse order (most recent first) to prioritize recent context
  const turnEntries: Array<{ index: number; content: string }> = [];
  let totalTurnTokens = 0;

  for (let idx = thread.turns.length - 1; idx >= 0; idx--) {
    const turn = thread.turns[idx];
    if (!turn) continue; // Skip if turn is undefined
    
    const turnNum = idx + 1;
    const roleLabel = turn.role === 'user' ? 'Claude' : 'Assistant';

    // Build turn content
    const turnParts: string[] = [];
    
    // Add turn header with tool attribution
    let turnHeader = `\n--- Turn ${turnNum} (${roleLabel}`;
    if (turn.tool) {
      turnHeader += ` using ${turn.tool}`;
    }
    if (turn.model) {
      turnHeader += ` via ${turn.model}`;
    }
    turnHeader += ') ---';
    turnParts.push(turnHeader);

    // Add files context if present
    if (turn.files && turn.files.length > 0) {
      turnParts.push(`Files used in this turn: ${turn.files.join(', ')}`);
      turnParts.push('');
    }

    // Add the actual content
    turnParts.push(turn.content);

    const turnContent = turnParts.join('\n');
    const turnTokens = modelContext.estimateTokens(turnContent);

    // Check if adding this turn would exceed history budget
    if (totalTurnTokens + turnTokens > maxHistoryTokens) {
      logger.debug(`[CONVERSATION_DEBUG] Stopping at turn ${turnNum} - would exceed history budget`);
      logger.debug(`[CONVERSATION_DEBUG]   Turn tokens so far: ${totalTurnTokens.toLocaleString()}`);
      logger.debug(`[CONVERSATION_DEBUG]   This turn: ${turnTokens.toLocaleString()}`);
      logger.debug(`[CONVERSATION_DEBUG]   Would total: ${(totalTurnTokens + turnTokens).toLocaleString()}`);
      logger.debug(`[CONVERSATION_DEBUG]   Budget: ${maxHistoryTokens.toLocaleString()}`);
      break;
    }

    // Add this turn to our list (we'll reverse it later for chronological order)
    turnEntries.push({ index: idx, content: turnContent });
    totalTurnTokens += turnTokens;
  }

  // Reverse to get chronological order (oldest first)
  turnEntries.reverse();

  // Add the turns in chronological order
  for (const entry of turnEntries) {
    historyParts.push(entry.content);
  }

  // Log what we included
  const includedTurns = turnEntries.length;
  const totalTurns = thread.turns.length;
  if (includedTurns < totalTurns) {
    logger.info(`[HISTORY] Included ${includedTurns}/${totalTurns} turns due to token limit`);
    historyParts.push(`\n[Note: Showing ${includedTurns} most recent turns out of ${totalTurns} total]`);
  }

  historyParts.push('');
  historyParts.push('=== END CONVERSATION HISTORY ===');
  historyParts.push('');
  historyParts.push('IMPORTANT: You are continuing an existing conversation thread. Build upon the previous exchanges shown above,');
  historyParts.push('reference earlier points, and maintain consistency with what has been discussed.');
  historyParts.push('');
  historyParts.push('DO NOT repeat or summarize previous analysis, findings, or instructions that are already covered in the');
  historyParts.push('conversation history. Instead, provide only new insights, additional analysis, or direct answers to');
  historyParts.push('the follow-up question / concerns / insights. Assume the user has read the prior conversation.');

  const history = historyParts.join('\n');
  const historyTokens = modelContext.estimateTokens(history);

  logger.debug(`[CONVERSATION_DEBUG] Conversation history built: ${historyTokens.toLocaleString()} tokens`);
  logger.debug(`[CONVERSATION_DEBUG] Conversation history length: ${history.length.toLocaleString()} chars`);

  return { history, tokens: historyTokens };
}

/**
 * Reconstruct thread context for continuation
 * This is called when a tool receives a continuation_id
 */
export async function reconstructThreadContext(
  args: Record<string, any>,
): Promise<Record<string, any>> {
  const continuationId = args.continuation_id as string;
  
  logger.debug(`[CONVERSATION_DEBUG] Looking up thread ${continuationId} in Redis`);
  const thread = await getThread(continuationId);
  
  if (!thread) {
    logger.warn(`Thread not found: ${continuationId}`);
    logger.debug(`[CONVERSATION_DEBUG] Thread ${continuationId} not found in Redis or expired`);
    
    throw new Error(
      `Conversation thread '${continuationId}' was not found or has expired. ` +
      `This may happen if the conversation was created more than 24 hours ago or if there was an issue ` +
      `with Redis storage. ` +
      `Please restart the conversation by providing your full question/prompt without the ` +
      `continuation_id parameter. ` +
      `This will create a new conversation thread that can continue with follow-up exchanges.`
    );
  }

  // Add user's new input to the conversation
  const userPrompt = args.prompt as string;
  if (userPrompt) {
    const userFiles = (args.files as string[]) || [];
    logger.debug(`[CONVERSATION_DEBUG] Adding user turn to thread ${continuationId}`);
    logger.debug(`[CONVERSATION_DEBUG] User prompt length: ${userPrompt.length} chars`);
    logger.debug(`[CONVERSATION_DEBUG] User files: ${userFiles.join(', ')}`);
    
    await addTurn(continuationId, 'user', userPrompt, {
      files: userFiles,
      tool: args.tool_name || 'unknown',
    });
  }

  // Create model context for history building
  const modelContext = ModelContext.fromArguments(args);
  
  logger.debug(`[CONVERSATION_DEBUG] Building conversation history for thread ${continuationId}`);
  const { history, tokens: conversationTokens } = await buildConversationHistory(thread, modelContext);
  
  // Calculate remaining token budget
  const allocation = await modelContext.calculateTokenAllocation();
  const remainingTokens = Math.max(0, allocation.contentTokens - conversationTokens);

  logger.debug('[CONVERSATION_DEBUG] Token budget calculation:');
  logger.debug(`[CONVERSATION_DEBUG]   Model: ${modelContext.modelName}`);
  logger.debug(`[CONVERSATION_DEBUG]   Total capacity: ${allocation.totalTokens.toLocaleString()}`);
  logger.debug(`[CONVERSATION_DEBUG]   Content allocation: ${allocation.contentTokens.toLocaleString()}`);
  logger.debug(`[CONVERSATION_DEBUG]   Conversation tokens: ${conversationTokens.toLocaleString()}`);
  logger.debug(`[CONVERSATION_DEBUG]   Remaining tokens: ${remainingTokens.toLocaleString()}`);

  // All tools now use standardized 'prompt' field
  const originalPrompt = args.prompt || '';
  const enhancedPrompt = history ? `${history}\n\n=== NEW USER INPUT ===\n${originalPrompt}` : originalPrompt;

  // Update arguments with enhanced context and remaining token budget
  const enhancedArgs = { ...args };
  enhancedArgs.prompt = enhancedPrompt;
  enhancedArgs._remaining_tokens = remainingTokens;
  enhancedArgs._model_context = modelContext;

  // Merge original context parameters with new request
  if (thread.initial_context) {
    logger.debug(`[CONVERSATION_DEBUG] Merging initial context with ${Object.keys(thread.initial_context).length} parameters`);
    for (const [key, value] of Object.entries(thread.initial_context)) {
      if (!(key in enhancedArgs) && !['temperature', 'thinking_mode', 'model'].includes(key)) {
        enhancedArgs[key] = value;
        logger.debug(`[CONVERSATION_DEBUG] Merged initial context param: ${key}`);
      }
    }
  }

  logger.info(`Reconstructed context for thread ${continuationId} (turn ${thread.turns.length})`);
  logger.debug(`[CONVERSATION_DEBUG] Final enhanced arguments keys: ${Object.keys(enhancedArgs).join(', ')}`);

  // Debug log files in the enhanced arguments for file tracking
  if (enhancedArgs.files) {
    logger.debug(`[CONVERSATION_DEBUG] Final files in enhanced arguments: ${(enhancedArgs.files as string[]).join(', ')}`);
  }

  return enhancedArgs;
}

/**
 * Extract all unique files from conversation turns with newest-first prioritization.
 *
 * This function implements the core file prioritization logic used throughout the
 * conversation memory system. It walks backwards through conversation turns
 * (from newest to oldest) and collects unique file references, ensuring that
 * when the same file appears in multiple turns, the reference from the NEWEST
 * turn takes precedence.
 *
 * PRIORITIZATION ALGORITHM:
 * 1. Iterate through turns in REVERSE order (index len-1 down to 0)
 * 2. For each turn, process files in the order they appear in turn.files
 * 3. Add file to result list only if not already seen (newest reference wins)
 * 4. Skip duplicate files that were already added from newer turns
 *
 * This ensures that:
 * - Files from newer conversation turns appear first in the result
 * - When the same file is referenced multiple times, only the newest reference is kept
 * - The order reflects the most recent conversation context
 *
 * Example:
 *   Turn 1: files = ["main.py", "utils.py"]
 *   Turn 2: files = ["test.py"]
 *   Turn 3: files = ["main.py", "config.py"]  // main.py appears again
 *
 *   Result: ["main.py", "config.py", "test.py", "utils.py"]
 *   (main.py from Turn 3 takes precedence over Turn 1)
 */
export function getConversationFileList(thread: ConversationThread): string[] {
  if (!thread.turns || thread.turns.length === 0) {
    logger.debug('[FILES] No turns found, returning empty file list');
    return [];
  }

  // Collect files by walking backwards (newest to oldest turns)
  const seenFiles = new Set<string>();
  const fileList: string[] = [];

  logger.debug(`[FILES] Collecting files from ${thread.turns.length} turns (newest first)`);

  // Process turns in reverse order (newest first) - this is the CORE of newest-first prioritization
  // By iterating from len-1 down to 0, we encounter newer turns before older turns
  // When we find a duplicate file, we skip it because the newer version is already in our list
  for (let i = thread.turns.length - 1; i >= 0; i--) {
    const turn = thread.turns[i];
    if (turn && turn.files && turn.files.length > 0) {
      logger.debug(`[FILES] Turn ${i + 1} has ${turn.files.length} files: ${turn.files.join(', ')}`);
      for (const filePath of turn.files) {
        if (!seenFiles.has(filePath)) {
          // First time seeing this file - add it (this is the NEWEST reference)
          seenFiles.add(filePath);
          fileList.push(filePath);
          logger.debug(`[FILES] Added new file: ${filePath} (from turn ${i + 1})`);
        } else {
          // File already seen from a NEWER turn - skip this older reference
          logger.debug(`[FILES] Skipping duplicate file: ${filePath} (newer version already included)`);
        }
      }
    }
  }

  logger.debug(`[FILES] Final file list (${fileList.length}): ${fileList.join(', ')}`);
  return fileList;
}

/**
 * Plan which files to include based on size constraints.
 *
 * This is ONLY used for conversation history building, not MCP boundary checks.
 *
 * @param allFiles List of files to consider for inclusion
 * @param maxFileTokens Maximum tokens available for file content
 * @returns Tuple of (files_to_include, files_to_skip, estimated_total_tokens)
 */
export async function planFileInclusionBySize(
  allFiles: string[],
  maxFileTokens: number,
): Promise<{ filesToInclude: string[]; filesToSkip: string[]; estimatedTotalTokens: number }> {
  if (!allFiles || allFiles.length === 0) {
    return { filesToInclude: [], filesToSkip: [], estimatedTotalTokens: 0 };
  }

  const filesToInclude: string[] = [];
  const filesToSkip: string[] = [];
  let totalTokens = 0;

  logger.debug(
    `[FILES] Planning inclusion for ${allFiles.length} files with budget ${maxFileTokens.toLocaleString()} tokens`,
  );

  for (const filePath of allFiles) {
    try {
      const estimatedTokens = await estimateFileTokens(filePath);

      if (totalTokens + estimatedTokens <= maxFileTokens) {
        filesToInclude.push(filePath);
        totalTokens += estimatedTokens;
        logger.debug(
          `[FILES] Including ${filePath} - ${estimatedTokens.toLocaleString()} tokens (total: ${totalTokens.toLocaleString()})`,
        );
      } else {
        filesToSkip.push(filePath);
        logger.debug(
          `[FILES] Skipping ${filePath} - would exceed budget (needs ${estimatedTokens.toLocaleString()} tokens)`,
        );
      }
    } catch (error) {
      filesToSkip.push(filePath);
      logger.debug(`[FILES] Skipping ${filePath} - error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  logger.debug(
    `[FILES] Inclusion plan: ${filesToInclude.length} include, ${filesToSkip.length} skip, ${totalTokens.toLocaleString()} tokens`,
  );
  return { filesToInclude, filesToSkip, estimatedTotalTokens: totalTokens };
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