/**
 * Conversation memory management using Redis
 *
 * This module handles persistent conversation threading across tool calls,
 * allowing AI tools to maintain context when users continue conversations.
 */

import { createClient, RedisClientType } from 'redis';
import { v4 as uuidv4 } from 'uuid';
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
 * Initialize Redis connection with retry logic
 */
export async function initializeRedis(): Promise<void> {
  if (redisClient) {
    return; // Already initialized
  }

  // Temporary debug flag to disable Redis conversation memory
  if (process.env.DISABLE_REDIS_CONVERSATION_MEMORY === 'true') {
    logger.info('Redis conversation memory disabled via environment variable');
    redisClient = null;
    return;
  }

  try {
    redisClient = createClient({
      url: REDIS_URL,
    });

    redisClient.on('error', (err) => logger.error('Redis Client Error', err));
    redisClient.on('connect', () => logger.info('Redis Client Connected'));
    redisClient.on('ready', () => logger.info('Redis Client Ready'));
    redisClient.on('reconnecting', () => logger.warn('Redis Client Reconnecting'));

    await connectWithRetry(redisClient);
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    // Continue without Redis - conversations won't persist
    redisClient = null;
  }
}

/**
 * Connect to Redis with exponential backoff retry
 */
async function connectWithRetry(client: RedisClientType, maxRetries: number = 10): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await client.connect();
      logger.info(`✅ Redis conversation memory connected successfully on attempt ${attempt}`);
      return;
    } catch (error) {
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
      logger.warn(`Redis conversation memory attempt ${attempt}/${maxRetries} failed, retrying in ${waitTime}ms...`);
      
      if (attempt === maxRetries) {
        logger.error('❌ Redis conversation memory failed after all retries. Conversation persistence disabled.');
        throw error; // Re-throw to trigger the catch block in initializeRedis
      }
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Create a new conversation thread (zen-compatible with parent threading)
 */
export async function createThread(
  toolName: string, 
  initialRequest: Record<string, any>,
  parentThreadId?: string
): Promise<string> {
  const threadId = generateThreadId();
  const now = new Date().toISOString();

  // Filter out non-serializable parameters to avoid JSON encoding issues (zen pattern)
  const filteredContext = Object.fromEntries(
    Object.entries(initialRequest).filter(([k]) => 
      !['temperature', 'thinking_mode', 'model', 'continuation_id'].includes(k)
    )
  );

  const thread: ConversationThread = {
    id: threadId,
    thread_id: threadId,
    parent_thread_id: parentThreadId, // Link to parent for conversation chains (zen compatibility)
    tool_name: toolName, // Track which tool initiated this conversation
    created_at: now,
    last_updated: now,
    turns: [], // Empty initially, turns added via addTurn()
    initial_context: filteredContext,
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

  logger.debug(`[THREAD] Created new thread ${threadId} with parent ${parentThreadId}`);
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
 * Add a turn to a conversation thread (zen-compatible with enhanced metadata)
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
    images?: string[]; // zen compatibility
    tool?: string;
    metadata?: Record<string, any>; // zen compatibility: model_metadata
  },
): Promise<boolean> {
  logger.debug(`[FLOW] Adding ${role} turn to ${threadId} (${options?.tool})`);

  if (!redisClient) {
    return false;
  }

  try {
    const thread = await getThread(threadId);
    if (!thread) {
      logger.debug(`[FLOW] Thread ${threadId} not found for turn addition`);
      return false;
    }

    // Check turn limit to prevent runaway conversations (zen pattern)
    if (thread.turns.length >= MAX_CONVERSATION_TURNS) {
      logger.debug(`[FLOW] Thread ${threadId} at max turns (${MAX_CONVERSATION_TURNS})`);
      return false;
    }

    // Create new turn with complete metadata (zen pattern)
    const turn: ConversationTurn = {
      role,
      content,
      timestamp: new Date().toISOString(),
      files: options?.files, // Preserved for cross-tool file context
      images: options?.images, // Preserved for cross-tool visual context (zen compatibility)
      tool: options?.tool, // Track which tool generated this turn
      model: options?.modelName, // Track specific model
      metadata: options?.metadata, // Additional model info (zen compatibility)
    };

    thread.turns.push(turn);
    thread.last_updated = new Date().toISOString();

    // Update metadata
    thread.metadata.total_input_tokens += options?.inputTokens || 0;
    thread.metadata.total_output_tokens += options?.outputTokens || 0;

    // Save back to Redis and refresh TTL (zen pattern: refresh TTL to configured timeout)
    const key = `${KEY_PREFIX}${threadId}`;
    await redisClient.setEx(key, CONVERSATION_TTL, JSON.stringify(thread));
    return true;
  } catch (error) {
    logger.debug(`[FLOW] Failed to save turn to storage: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
    return false;
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
 * Get the complete thread chain following parent links.
 *
 * Retrieves the complete conversation chain by following parent_thread_id
 * links. Returns threads in chronological order (oldest first).
 *
 * Args:
 *   threadId: Starting thread ID
 *   maxDepth: Maximum chain depth to prevent infinite loops
 *
 * Returns:
 *   Array of threads in chain, oldest first
 */
export async function getThreadChain(threadId: string, maxDepth: number = 20): Promise<ConversationThread[]> {
  const chain: ConversationThread[] = [];
  let currentId: string | null = threadId;
  const seenIds = new Set<string>();

  // Build chain from current to oldest
  while (currentId && chain.length < maxDepth) {
    // Prevent circular references
    if (seenIds.has(currentId)) {
      logger.warn(`[THREAD] Circular reference detected in thread chain at ${currentId}`);
      break;
    }

    seenIds.add(currentId);

    const context = await getThread(currentId);
    if (!context) {
      logger.debug(`[THREAD] Thread ${currentId} not found in chain traversal`);
      break;
    }

    chain.push(context);
    currentId = context.parent_thread_id || null;
  }

  // Reverse to get chronological order (oldest first)
  chain.reverse();

  logger.debug(`[THREAD] Retrieved chain of ${chain.length} threads for ${threadId}`);
  return chain;
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
 * CONVERSATION CHAIN HANDLING:
 * If the thread has a parent_thread_id, this function traverses the entire chain
 * to include complete conversation history across multiple linked threads. File
 * prioritization works across the entire chain, not just the current thread.
 *
 * CONVERSATION TURN ORDERING STRATEGY:
 * The function employs a sophisticated two-phase approach for optimal token utilization:
 *
 * PHASE 1 - COLLECTION (Newest-First for Token Budget):
 * - Processes conversation turns in REVERSE chronological order (newest to oldest)
 * - Prioritizes recent turns within token constraints
 * - If token budget is exceeded, OLDER turns are excluded first
 * - Ensures the most contextually relevant recent exchanges are preserved
 *
 * PHASE 2 - PRESENTATION (Chronological for LLM Understanding):
 * - Reverses the collected turns back to chronological order (oldest to newest)
 * - Presents conversation flow naturally for LLM comprehension
 * - Maintains "--- Turn 1, Turn 2, Turn 3..." sequential numbering
 * - Enables LLM to follow conversation progression logically
 *
 * This approach balances recency prioritization with natural conversation flow.
 *
 * TOKEN MANAGEMENT:
 * - Uses model-specific token allocation (file_tokens + history_tokens)
 * - Files are embedded ONCE at the start to prevent duplication
 * - Turn collection prioritizes newest-first, presentation shows chronologically
 * - Stops adding turns when token budget would be exceeded
 * - Gracefully handles token limits with informative notes
 */
export async function buildConversationHistory(
  thread: ConversationThread,
  modelContext: ModelContext,
): Promise<{ history: string; tokens: number }> {
  // Get the complete thread chain if parent exists (zen pattern)
  let allTurns: ConversationTurn[];
  let totalTurns: number;
  let allFiles: string[];

  if (thread.parent_thread_id) {
    // This thread has a parent, get the full chain
    const chain = await getThreadChain(thread.id);

    // Collect all turns from all threads in chain
    allTurns = [];
    totalTurns = 0;

    for (const threadInChain of chain) {
      allTurns.push(...threadInChain.turns);
      totalTurns += threadInChain.turns.length;
    }

    // Use centralized file collection logic for consistency across the entire chain
    // This ensures files from newer turns across ALL threads take precedence
    // over files from older turns, maintaining the newest-first prioritization
    // even when threads are chained together
    const tempContext: ConversationThread = {
      ...thread,
      id: 'merged_chain',
      turns: allTurns, // All turns from entire chain in chronological order
    };
    allFiles = getConversationFileList(tempContext); // Applies newest-first logic to entire chain
    logger.debug(`[THREAD] Built history from ${chain.length} threads with ${totalTurns} total turns`);
  } else {
    // Single thread, no parent chain
    allTurns = thread.turns;
    totalTurns = thread.turns.length;
    allFiles = getConversationFileList(thread);
  }

  if (!allTurns || allTurns.length === 0) {
    return { history: '', tokens: 0 };
  }

  logger.debug(`[FILES] Found ${allFiles.length} unique files in conversation history`);

  // Get model-specific token allocation
  const allocation = await modelContext.calculateTokenAllocation();
  const maxFileTokens = allocation.fileTokens || Math.floor(allocation.contentTokens * 0.7);
  const maxHistoryTokens = allocation.historyTokens;

  logger.debug(`[HISTORY] Using model-specific limits for ${modelContext.modelName}:`);
  logger.debug(`[HISTORY]   Max file tokens: ${maxFileTokens.toLocaleString()}`);
  logger.debug(`[HISTORY]   Max history tokens: ${maxHistoryTokens.toLocaleString()}`);

  const historyParts: string[] = [
    '=== CONVERSATION HISTORY (CONTINUATION) ===',
    `Thread: ${thread.id}`,
    `Tool: ${thread.tool_name}`, // Original tool that started the conversation
    `Turn ${totalTurns}/${MAX_CONVERSATION_TURNS}`,
    'You are continuing this conversation thread from where it left off.',
    '',
  ];

  // Embed files referenced in this conversation with size-aware selection
  if (allFiles.length > 0) {
    logger.debug(`[FILES] Starting embedding for ${allFiles.length} files`);

    // Plan file inclusion based on size constraints
    // CRITICAL: allFiles is already ordered by newest-first prioritization from getConversationFileList()
    // So when planFileInclusionBySize() hits token limits, it naturally excludes OLDER files first
    // while preserving the most recent file references - exactly what we want!
    const { filesToInclude, filesToSkip, estimatedTotalTokens } = await planFileInclusionBySize(allFiles, maxFileTokens);

    if (filesToSkip.length > 0) {
      logger.info(`[FILES] Excluding ${filesToSkip.length} files from conversation history: ${filesToSkip.join(', ')}`);
      logger.debug('[FILES] Files excluded for various reasons (size constraints, missing files, access issues)');
    }

    if (filesToInclude.length > 0) {
      historyParts.push(
        '=== FILES REFERENCED IN THIS CONVERSATION ===',
        'The following files have been shared and analyzed during our conversation.',
        filesToSkip.length === 0 ? '' : `[NOTE: ${filesToSkip.length} files omitted (size constraints, missing files, or access issues)]`,
        'Refer to these when analyzing the context and requests below:',
        '',
      );

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
          historyParts.push(
            '',
            `[NOTE: ${filesToSkip.length} additional file(s) were omitted due to size constraints, missing files, or access issues. ` +
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

      historyParts.push('', '=== END REFERENCED FILES ===', '');
    }
  }

  historyParts.push('Previous conversation turns:');

  // === PHASE 1: COLLECTION (Newest-First for Token Budget) ===
  // Build conversation turns bottom-up (most recent first) to prioritize recent context within token limits
  // This ensures we include as many recent turns as possible within the token budget by excluding
  // OLDER turns first when space runs out, preserving the most contextually relevant exchanges
  const turnEntries: Array<{ index: number; content: string }> = []; // Will store (index, formatted_turn_content) for chronological ordering later
  let totalTurnTokens = 0;
  const fileEmbeddingTokens = historyParts.reduce((sum, part) => sum + modelContext.estimateTokens(part), 0);

  // CRITICAL: Process turns in REVERSE chronological order (newest to oldest)
  // This prioritization strategy ensures recent context is preserved when token budget is tight
  for (let idx = allTurns.length - 1; idx >= 0; idx--) {
    const turn = allTurns[idx];
    if (!turn) continue; // Skip undefined turns
    
    const turnNum = idx + 1;
    const roleLabel = turn.role === 'user' ? 'Claude' : 'Assistant';

    // Build the complete turn content
    const turnParts: string[] = [];

    // Add turn header with tool attribution for cross-tool tracking
    let turnHeader = `\n--- Turn ${turnNum} (${roleLabel}`;
    if (turn.tool) {
      turnHeader += ` using ${turn.tool}`;
    }

    // Add model info if available (matching zen pattern)
    if (turn.model) {
      turnHeader += ` via ${turn.model}`;
    }

    turnHeader += ') ---';
    turnParts.push(turnHeader);

    // Get tool-specific formatting if available (zen pattern)
    const toolFormattedContent = await getToolFormattedContent(turn);
    turnParts.push(...toolFormattedContent);

    // Calculate tokens for this turn
    const turnContent = turnParts.join('\n');
    const turnTokens = modelContext.estimateTokens(turnContent);

    // Check if adding this turn would exceed history budget
    if (fileEmbeddingTokens + totalTurnTokens + turnTokens > maxHistoryTokens) {
      // Stop adding turns - we've reached the limit
      logger.debug(`[HISTORY] Stopping at turn ${turnNum} - would exceed history budget`);
      logger.debug(`[HISTORY]   File tokens: ${fileEmbeddingTokens.toLocaleString()}`);
      logger.debug(`[HISTORY]   Turn tokens so far: ${totalTurnTokens.toLocaleString()}`);
      logger.debug(`[HISTORY]   This turn: ${turnTokens.toLocaleString()}`);
      logger.debug(`[HISTORY]   Would total: ${(fileEmbeddingTokens + totalTurnTokens + turnTokens).toLocaleString()}`);
      logger.debug(`[HISTORY]   Budget: ${maxHistoryTokens.toLocaleString()}`);
      break;
    }

    // Add this turn to our collection (we'll reverse it later for chronological presentation)
    // Store the original index to maintain proper turn numbering in final output
    turnEntries.push({ index: idx, content: turnContent });
    totalTurnTokens += turnTokens;
  }

  // === PHASE 2: PRESENTATION (Chronological for LLM Understanding) ===
  // Reverse the collected turns to restore chronological order (oldest first)
  // This gives the LLM a natural conversation flow: Turn 1 → Turn 2 → Turn 3...
  // while still having prioritized recent turns during the token-constrained collection phase
  turnEntries.reverse();

  // Add the turns in chronological order for natural LLM comprehension
  // The LLM will see: "--- Turn 1 (Claude) ---" followed by "--- Turn 2 (Assistant) ---" etc.
  for (const { content } of turnEntries) {
    historyParts.push(content);
  }

  // Log what we included
  const includedTurns = turnEntries.length;
  if (includedTurns < totalTurns) {
    logger.info(`[HISTORY] Included ${includedTurns}/${totalTurns} turns due to token limit`);
    historyParts.push(`\n[Note: Showing ${includedTurns} most recent turns out of ${totalTurns} total]`);
  }

  historyParts.push(
    '',
    '=== END CONVERSATION HISTORY ===',
    '',
    'IMPORTANT: You are continuing an existing conversation thread. Build upon the previous exchanges shown above,',
    'reference earlier points, and maintain consistency with what has been discussed.',
    '',
    'DO NOT repeat or summarize previous analysis, findings, or instructions that are already covered in the',
    'conversation history. Instead, provide only new insights, additional analysis, or direct answers to',
    'the follow-up question / concerns / insights. Assume the user has read the prior conversation.',
    '',
    `This is turn ${totalTurns + 1} of the conversation - use the conversation history above to provide a coherent continuation.`,
  );

  // Calculate total tokens for the complete conversation history
  const completeHistory = historyParts.join('\n');
  const totalConversationTokens = modelContext.estimateTokens(completeHistory);

  // Summary log of what was built
  const userTurns = allTurns.filter(t => t.role === 'user').length;
  const assistantTurns = allTurns.filter(t => t.role === 'assistant').length;
  logger.debug(
    `[FLOW] Built conversation history: ${userTurns} user + ${assistantTurns} assistant turns, ${allFiles.length} files, ${totalConversationTokens.toLocaleString()} tokens`,
  );

  return { history: completeHistory, tokens: totalConversationTokens };
}

/**
 * Get tool-specific formatting for a conversation turn.
 *
 * This function attempts to use the tool's custom formatting method if available,
 * falling back to default formatting if the tool cannot be found or doesn't
 * provide custom formatting.
 *
 * Args:
 *   turn: The conversation turn to format
 *
 * Returns:
 *   Formatted content lines for this turn
 */
async function getToolFormattedContent(turn: ConversationTurn): Promise<string[]> {
  if (turn.tool) {
    try {
      // Try to dynamically import tool registry
      const indexModule = await import('../index.js');
      const tools = (indexModule as any).TOOLS;

      if (tools && tools[turn.tool]) {
        const tool = tools[turn.tool];
        if (tool && typeof (tool as any).formatConversationTurn === 'function') {
          // Use tool-specific formatting
          return (tool as any).formatConversationTurn(turn);
        }
      }
    } catch (error) {
      // Log but don't fail - fall back to default formatting
      logger.debug(`[HISTORY] Could not get tool-specific formatting for ${turn.tool}: ${error}`);
    }
  }

  // Default formatting
  return getDefaultTurnFormatting(turn);
}

/**
 * Default formatting for conversation turns.
 *
 * This provides the standard formatting when no tool-specific
 * formatting is available.
 *
 * Args:
 *   turn: The conversation turn to format
 *
 * Returns:
 *   Default formatted content lines
 */
function getDefaultTurnFormatting(turn: ConversationTurn): string[] {
  const parts: string[] = [];

  // Add files context if present
  if (turn.files && turn.files.length > 0) {
    parts.push(`Files used in this turn: ${turn.files.join(', ')}`);
    parts.push(''); // Empty line for readability
  }

  // Add the actual content
  parts.push(turn.content);

  return parts;
}

/**
 * Reconstruct thread context for continuation (zen-compatible with cross-tool context preservation)
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
      `This may happen if the conversation was created more than ${CONVERSATION_TTL / 3600} hours ago or if there was an issue ` +
      `with Redis storage. ` +
      `Please restart the conversation by providing your full question/prompt without the ` +
      `continuation_id parameter. ` +
      `This will create a new conversation thread that can continue with follow-up exchanges.`
    );
  }

  // Add user's new input to the conversation (zen pattern)
  const userPrompt = args.prompt as string;
  if (userPrompt) {
    const userFiles = (args.files as string[]) || [];
    const userImages = (args.images as string[]) || []; // zen compatibility
    logger.debug(`[CONVERSATION_DEBUG] Adding user turn to thread ${continuationId}`);
    logger.debug(`[CONVERSATION_DEBUG] User prompt length: ${userPrompt.length} chars`);
    logger.debug(`[CONVERSATION_DEBUG] User files: ${userFiles.join(', ')}`);
    logger.debug(`[CONVERSATION_DEBUG] User images: ${userImages.join(', ')}`);
    
    await addTurn(continuationId, 'user', userPrompt, {
      files: userFiles,
      images: userImages, // zen compatibility
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

  // All tools now use standardized 'prompt' field (zen pattern)
  const originalPrompt = args.prompt || '';
  const enhancedPrompt = history ? `${history}\n\n=== NEW USER INPUT ===\n${originalPrompt}` : originalPrompt;

  // Update arguments with enhanced context and remaining token budget
  const enhancedArgs = { ...args };
  enhancedArgs.prompt = enhancedPrompt;
  enhancedArgs._remaining_tokens = remainingTokens;
  enhancedArgs._model_context = modelContext;

  // Merge original context parameters with new request (zen pattern for cross-tool continuation)
  if (thread.initial_context) {
    logger.debug(`[CONVERSATION_DEBUG] Merging initial context with ${Object.keys(thread.initial_context).length} parameters`);
    for (const [key, value] of Object.entries(thread.initial_context)) {
      if (!(key in enhancedArgs) && !['temperature', 'thinking_mode', 'model'].includes(key)) {
        enhancedArgs[key] = value;
        logger.debug(`[CONVERSATION_DEBUG] Merged initial context param: ${key}`);
      }
    }
  }

  // CRITICAL: Merge file contexts from previous tools (zen cross-tool continuation pattern)
  // Get all files referenced in this conversation and merge with current request
  const conversationFiles = getConversationFileList(thread);
  const conversationImages = getConversationImageList(thread);
  const currentFiles = (enhancedArgs.files as string[]) || [];
  const currentImages = (enhancedArgs.images as string[]) || [];

  // Merge files with newest-first prioritization: current request files come first,
  // then add conversation files that aren't already in the current request
  const mergedFiles = [...currentFiles];
  for (const file of conversationFiles) {
    if (!mergedFiles.includes(file)) {
      mergedFiles.push(file);
    }
  }

  // Same pattern for images (zen compatibility)
  const mergedImages = [...currentImages];
  for (const image of conversationImages) {
    if (!mergedImages.includes(image)) {
      mergedImages.push(image);
    }
  }

  // Update enhanced args with merged file contexts
  if (mergedFiles.length > 0) {
    enhancedArgs.files = mergedFiles;
    logger.debug(`[CONVERSATION_DEBUG] Merged file context: ${mergedFiles.length} files total`);
    logger.debug(`[CONVERSATION_DEBUG] Current files: ${currentFiles.join(', ')}`);
    logger.debug(`[CONVERSATION_DEBUG] Conversation files: ${conversationFiles.join(', ')}`);
  }

  if (mergedImages.length > 0) {
    enhancedArgs.images = mergedImages;
    logger.debug(`[CONVERSATION_DEBUG] Merged image context: ${mergedImages.length} images total`);
  }

  logger.info(`Reconstructed context for thread ${continuationId} (turn ${thread.turns.length})`);
  logger.debug(`[CONVERSATION_DEBUG] Final enhanced arguments keys: ${Object.keys(enhancedArgs).join(', ')}`);

  // Debug log files and images in the enhanced arguments for file tracking
  if (enhancedArgs.files) {
    logger.debug(`[CONVERSATION_DEBUG] Final files in enhanced arguments: ${(enhancedArgs.files as string[]).join(', ')}`);
  }
  if (enhancedArgs.images) {
    logger.debug(`[CONVERSATION_DEBUG] Final images in enhanced arguments: ${(enhancedArgs.images as string[]).join(', ')}`);
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
 * Extract all unique images from conversation turns with newest-first prioritization.
 *
 * This function implements the identical prioritization logic as getConversationFileList()
 * to ensure consistency in how images are handled across conversation turns. It walks
 * backwards through conversation turns (from newest to oldest) and collects unique image
 * references, ensuring that when the same image appears in multiple turns, the reference
 * from the NEWEST turn takes precedence.
 *
 * PRIORITIZATION ALGORITHM:
 * 1. Iterate through turns in REVERSE order (index len-1 down to 0)
 * 2. For each turn, process images in the order they appear in turn.images  
 * 3. Add image to result list only if not already seen (newest reference wins)
 * 4. Skip duplicate images that were already added from newer turns
 *
 * This ensures that:
 * - Images from newer conversation turns appear first in the result
 * - When the same image is referenced multiple times, only the newest reference is kept
 * - The order reflects the most recent conversation context
 *
 * Example:
 *   Turn 1: images = ["diagram.png", "flow.jpg"]
 *   Turn 2: images = ["error.png"] 
 *   Turn 3: images = ["diagram.png", "updated.png"]  // diagram.png appears again
 *
 *   Result: ["diagram.png", "updated.png", "error.png", "flow.jpg"]
 *   (diagram.png from Turn 3 takes precedence over Turn 1)
 */
export function getConversationImageList(thread: ConversationThread): string[] {
  if (!thread.turns || thread.turns.length === 0) {
    logger.debug('[IMAGES] No turns found, returning empty image list');
    return [];
  }

  // Collect images by walking backwards (newest to oldest turns)
  const seenImages = new Set<string>();
  const imageList: string[] = [];

  logger.debug(`[IMAGES] Collecting images from ${thread.turns.length} turns (newest first)`);

  // Process turns in reverse order (newest first) - this is the CORE of newest-first prioritization
  // By iterating from len-1 down to 0, we encounter newer turns before older turns
  // When we find a duplicate image, we skip it because the newer version is already in our list
  for (let i = thread.turns.length - 1; i >= 0; i--) {
    const turn = thread.turns[i];
    if (turn && turn.images && turn.images.length > 0) {
      logger.debug(`[IMAGES] Turn ${i + 1} has ${turn.images.length} images: ${turn.images.join(', ')}`);
      for (const imagePath of turn.images) {
        if (!seenImages.has(imagePath)) {
          // First time seeing this image - add it (this is the NEWEST reference)
          seenImages.add(imagePath);
          imageList.push(imagePath);
          logger.debug(`[IMAGES] Added new image: ${imagePath} (from turn ${i + 1})`);
        } else {
          // Image already seen from a NEWER turn - skip this older reference
          logger.debug(`[IMAGES] Skipping duplicate image: ${imagePath} (newer version already included)`);
        }
      }
    }
  }

  logger.debug(`[IMAGES] Final image list (${imageList.length}): ${imageList.join(', ')}`);
  return imageList;
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
  // Use uuid v4 library to generate proper UUID format to match Python implementation
  // and satisfy Zod UUID validation requirements. This ensures consistency across
  // the Python and Node.js implementations.
  return uuidv4();
}


// Initialize Redis on module load (only if not disabled)
if (process.env.DISABLE_REDIS_CONVERSATION_MEMORY !== 'true' && process.env.DISABLE_ALL_REDIS !== 'true') {
  initializeRedis().catch((error) => {
    logger.error('Failed to initialize Redis on module load:', error);
  });
} else {
  logger.info('Redis conversation memory initialization skipped (disabled via environment variable)');
}