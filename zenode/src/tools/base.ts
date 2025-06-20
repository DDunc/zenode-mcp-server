/**
 * Base class for all Zenode MCP tools
 *
 * This module provides the abstract base class that all tools must inherit from.
 * It defines the contract that tools must implement and provides common functionality
 * for request validation, error handling, and response formatting.
 *
 * Key responsibilities:
 * - Define the tool interface (abstract methods that must be implemented)
 * - Handle request validation and file path security
 * - Manage model selection and provider interaction
 * - Standardize response formatting and error handling
 * - Support for clarification requests when more information is needed
 */

import { z } from 'zod';
import {
  BaseTool as BaseToolInterface,
  ToolRequest,
  ToolOutput,
  ToolModelCategory,
  ContinuationOffer,
} from '../types/tools.js';
import { zodToJsonSchema, validateToolArgs } from '../utils/schema-helpers.js';
import { ModelProvider, ModelRequest, Message } from '../types/providers.js';
import { modelProviderRegistry } from '../providers/registry.js';
import { validateImages } from '../utils/image-utils.js';
import { 
  DEFAULT_MODEL, 
  DEFAULT_VISION_MODEL,
  IS_AUTO_MODE, 
  MODEL_CAPABILITIES_DESC,
  MCP_PROMPT_SIZE_LIMIT,
} from '../config.js';
import { logger } from '../utils/logger.js';
import {
  createThread,
  addTurn,
  getConversationStats,
} from '../utils/conversation-memory.js';
import { 
  readFile, 
  translatePathForEnvironment, 
  estimateFileTokens, 
  checkTotalFileSize 
} from '../utils/file-utils.js';
import { redisConversationLogger } from '../utils/redis-conversation-logger.js';

/**
 * Base request schema with common fields
 */
export const BaseRequestSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().optional(),
  thinking_mode: z.enum(['minimal', 'low', 'medium', 'high', 'max']).optional(),
  use_websearch: z.boolean().default(true),
  continuation_id: z.string().optional(),
  images: z.array(z.string()).optional().describe(
    "Optional image(s) for visual context. Accepts absolute file paths or " +
    "base64 data URLs. Useful for UI discussions, diagrams, visual problems, " +
    "error screens, architecture mockups, and visual analysis tasks."
  ),
  related_threads: z.array(z.string()).optional().describe(
    "Optional thread IDs to reference for context. The system will automatically " +
    "inject relevant information from these conversations into the current request."
  ),
  smart_context: z.boolean().default(true).describe(
    "Enable automatic smart context detection and injection from related threads. " +
    "Set to false to disable automatic context suggestions."
  ),
});

/**
 * Abstract base class for all tools
 */
export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract defaultTemperature: number;
  abstract modelCategory: ToolModelCategory;

  /**
   * Get the Zod schema for this tool's input validation
   */
  abstract getZodSchema(): z.ZodSchema;

  /**
   * Get the JSON Schema for this tool's input (for MCP protocol)
   */
  getInputSchema(): any {
    return zodToJsonSchema(this.getZodSchema());
  }

  /**
   * Get the system prompt for this tool
   */
  abstract getSystemPrompt(): string;

  /**
   * Execute the tool with given arguments
   */
  abstract execute(args: ToolRequest): Promise<ToolOutput>;

  /**
   * Log tool execution request (Redis-based conversation logger)
   */
  protected async logToolRequest(
    requestId: string,
    input: any,
    conversationId?: string
  ): Promise<void> {
    try {
      await redisConversationLogger.logRequest(
        requestId,
        this.name,
        input,
        conversationId
      );
    } catch (error) {
      logger.warn('Failed to log tool request:', error);
    }
  }

  /**
   * Log tool execution response (Redis-based conversation logger)
   */
  protected async logToolResponse(
    requestId: string,
    output: any,
    error?: Error,
    duration?: number,
    conversationId?: string
  ): Promise<void> {
    try {
      await redisConversationLogger.logResponse(
        requestId,
        this.name,
        output,
        error,
        duration,
        conversationId
      );
    } catch (error) {
      logger.warn('Failed to log tool response:', error);
    }
  }

  /**
   * Validate and parse tool arguments
   */
  protected validateArgs<T>(args: any): T {
    return validateToolArgs(this.getZodSchema(), args);
  }

  /**
   * Inject smart context from related threads
   */
  protected async injectSmartContext(args: any): Promise<{ enhancedArgs: any; contextInfo?: any }> {
    // Skip context injection if disabled or if this is the threads tool itself
    if (args.smart_context === false || this.name === 'threads') {
      return { enhancedArgs: args };
    }

    try {
      const { createClient } = await import('redis');
      const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
      await redisClient.connect();

      let contextThreads: string[] = [];
      
      // Use explicitly provided related threads
      if (args.related_threads && Array.isArray(args.related_threads)) {
        contextThreads = args.related_threads;
      }
      // Auto-detect related threads if smart context is enabled
      else if (args.smart_context !== false && args.prompt && typeof args.prompt === 'string') {
        contextThreads = await this.findRelatedThreads(args.prompt, redisClient);
      }

      let contextInfo = null;
      if (contextThreads.length > 0) {
        const contextDetails = await this.buildDetailedContextInfo(contextThreads, redisClient);
        if (contextDetails) {
          // Inject context as additional system message or prompt enhancement
          const originalPrompt = args.prompt || '';
          args.prompt = `${originalPrompt}

🔗 **Related Context:**
${contextDetails.contextText}

Please reference this context when relevant to provide better assistance.`;
          
          contextInfo = {
            threadsFound: contextDetails.threads,
            strategy: args.related_threads ? 'explicit' : 'auto-detected',
            injected: true
          };
        }
      }

      await redisClient.quit();
      return { enhancedArgs: args, contextInfo };
    } catch (error) {
      logger.warn('Smart context injection failed:', error);
      return { enhancedArgs: args }; // Return original args if context injection fails
    }
  }

  /**
   * Find related threads based on content similarity
   */
  private async findRelatedThreads(prompt: string, redisClient: any): Promise<string[]> {
    try {
      // Extract keywords from the prompt
      const keywords = this.extractKeywords(prompt);
      if (keywords.length === 0) {
        return [];
      }

      const relatedThreads: Array<{ id: string; score: number }> = [];
      const metadataKeys = await redisClient.keys('zenode:thread:meta:*');
      
      // Limit search to avoid performance issues
      const maxThreadsToCheck = Math.min(metadataKeys.length, 50);
      
      for (const key of metadataKeys.slice(0, maxThreadsToCheck)) {
        try {
          const metadataStr = await redisClient.get(key);
          if (!metadataStr) continue;
          
          const metadata = JSON.parse(metadataStr);
          const threadId = key.replace('zenode:thread:meta:', '');
          
          // Skip current thread if continuation_id matches
          if (threadId === prompt) continue;
          
          // Calculate relevance score
          const score = this.calculateContextRelevance(keywords, metadata);
          if (score > 0.3) { // Threshold for relevance
            relatedThreads.push({ id: threadId, score });
          }
        } catch (error) {
          logger.warn(`Failed to process metadata for ${key}:`, error);
        }
      }

      // Sort by relevance and return top 3
      return relatedThreads
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(t => t.id);
        
    } catch (error) {
      logger.warn('Failed to find related threads:', error);
      return [];
    }
  }

  /**
   * Extract keywords from prompt for thread matching
   */
  private extractKeywords(prompt: string): string[] {
    const text = prompt.toLowerCase();
    
    // Common programming/technical terms that indicate relevance
    const keywords = [];
    
    // Extract file extensions and paths
    const fileExtensions = text.match(/\.\w+/g) || [];
    keywords.push(...fileExtensions);
    
    // Extract technical terms (simple approach)
    const technicalTerms = [
      'error', 'bug', 'fix', 'debug', 'test', 'api', 'database', 'server',
      'frontend', 'backend', 'authentication', 'auth', 'login', 'security',
      'performance', 'optimization', 'refactor', 'typescript', 'javascript',
      'python', 'react', 'node', 'redis', 'docker', 'git', 'deploy',
      'build', 'compile', 'lint', 'format', 'config', 'setup'
    ];
    
    for (const term of technicalTerms) {
      if (text.includes(term)) {
        keywords.push(term);
      }
    }
    
    // Extract quoted strings (often file names or specific terms)
    const quotedStrings = text.match(/"([^"]+)"/g) || [];
    keywords.push(...quotedStrings.map(s => s.replace(/"/g, '')));
    
    return [...new Set(keywords)].filter(k => k.length > 2);
  }

  /**
   * Calculate relevance score between keywords and thread metadata
   */
  private calculateContextRelevance(keywords: string[], metadata: any): number {
    let score = 0;
    
    const searchableText = [
      metadata.label || '',
      metadata.tags?.join(' ') || '',
      metadata.tools_used?.join(' ') || '',
      metadata.auto_generated_label || ''
    ].join(' ').toLowerCase();
    
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      if (searchableText.includes(keywordLower)) {
        // Boost score based on where the match occurs
        if ((metadata.label || '').toLowerCase().includes(keywordLower)) {
          score += 0.5; // High weight for label matches
        } else if (metadata.tags?.some((tag: string) => tag.toLowerCase().includes(keywordLower))) {
          score += 0.3; // Medium weight for tag matches
        } else {
          score += 0.1; // Lower weight for other matches
        }
      }
    }
    
    // Recency boost - more recent threads get higher scores
    if (metadata.last_accessed) {
      const daysSinceAccess = (Date.now() - new Date(metadata.last_accessed).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceAccess < 7) {
        score += 0.2; // Boost for threads accessed in last week
      }
    }
    
    // Activity boost - threads with more turns are likely more valuable
    if (metadata.total_turns > 5) {
      score += 0.1;
    }
    
    return Math.min(1.0, score);
  }

  /**
   * Build detailed context information from related threads
   */
  private async buildDetailedContextInfo(threadIds: string[], redisClient: any): Promise<{ threads: any[]; contextText: string } | null> {
    try {
      const contextParts = [];
      const threads = [];
      
      for (const threadId of threadIds) {
        const metadataKey = `zenode:thread:meta:${threadId}`;
        const metadataStr = await redisClient.get(metadataKey);
        
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          
          // Store thread info for UI display
          threads.push({
            id: threadId,
            label: metadata.label || 'Unlabeled',
            tags: metadata.tags || [],
            turns: metadata.total_turns,
            tools: metadata.tools_used || [],
            lastAccessed: metadata.last_accessed,
            previewSummary: metadata.preview_summary || null,
            relevanceScore: 0.85 // Placeholder - would be calculated in real implementation
          });
          
          const contextPart = [
            `• **${metadata.label || 'Unlabeled'}** (${threadId.substring(0, 8)}...)`,
            `  ${metadata.tags?.length > 0 ? `Tags: ${metadata.tags.slice(0, 3).join(', ')}` : ''}`,
            `  ${metadata.total_turns} turns, tools: ${metadata.tools_used?.slice(0, 3).join(', ') || 'none'}`
          ].filter(line => line.trim()).join('\n');
          
          contextParts.push(contextPart);
        }
      }
      
      const contextText = contextParts.length > 0 ? contextParts.join('\n\n') : '';
      return { threads, contextText };
    } catch (error) {
      logger.warn('Failed to build detailed context info:', error);
      return null;
    }
  }

  /**
   * Build context information from related threads (legacy method)
   */
  private async buildContextInfo(threadIds: string[], redisClient: any): Promise<string | null> {
    try {
      const contextParts = [];
      
      for (const threadId of threadIds) {
        const metadataKey = `zenode:thread:meta:${threadId}`;
        const metadataStr = await redisClient.get(metadataKey);
        
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          const contextPart = [
            `• **${metadata.label || 'Unlabeled'}** (${threadId.substring(0, 8)}...)`,
            `  ${metadata.tags?.length > 0 ? `Tags: ${metadata.tags.slice(0, 3).join(', ')}` : ''}`,
            `  ${metadata.total_turns} turns, tools: ${metadata.tools_used?.slice(0, 3).join(', ') || 'none'}`
          ].filter(line => line.trim()).join('\n');
          
          contextParts.push(contextPart);
        }
      }
      
      return contextParts.length > 0 ? contextParts.join('\n\n') : null;
    } catch (error) {
      logger.warn('Failed to build context info:', error);
      return null;
    }
  }

  /**
   * Format context suggestion UI for tool responses
   */
  protected formatContextSuggestion(contextInfo: any): string {
    if (!contextInfo || !contextInfo.threadsFound || contextInfo.threadsFound.length === 0) {
      return '';
    }

    const threads = contextInfo.threadsFound;
    const strategy = contextInfo.strategy === 'explicit' ? 'specified' : 'auto-detected';
    
    let suggestion = `\n\n🔗 **Related Context ${contextInfo.injected ? 'Applied' : 'Available'}** (${threads.length} ${strategy})\n`;
    
    for (const thread of threads) {
      const relevancePercent = Math.round(thread.relevanceScore * 100);
      const shortId = thread.id.substring(0, 8);
      suggestion += `\n• **${thread.label}** (${relevancePercent}% match, ${shortId}...)`;
      if (thread.tags.length > 0) {
        suggestion += `\n  Tags: ${thread.tags.slice(0, 3).join(', ')}`;
      }
      suggestion += `\n  ${thread.turns} turns using ${thread.tools.slice(0, 2).join(', ')}`;
      
      // Add 4-sentence preview summary if available
      if (thread.previewSummary) {
        suggestion += `\n  **Preview:** ${thread.previewSummary}`;
      }
    }

    if (contextInfo.injected) {
      suggestion += `\n\n💡 *This context was automatically included in my analysis. Use \`smart_context: false\` to disable.*`;
    } else {
      suggestion += `\n\n💡 *Use \`related_threads: ["${threads[0].id}"]\` to include this context.*`;
    }

    return suggestion;
  }

  /**
   * Select the best model for this request
   */
  protected async selectModel(
    requestedModel: string | undefined,
    provider?: ModelProvider,
    hasImages?: boolean,
  ): Promise<string> {
    // Handle explicit "auto" model request
    if (requestedModel === 'auto') {
      return this.selectBestModel(hasImages);
    }

    // If a specific model is requested, validate and use it
    if (requestedModel && !IS_AUTO_MODE) {
      const capabilities = await modelProviderRegistry.getModelCapabilities(requestedModel);
      if (!capabilities) {
        throw new Error(`Model ${requestedModel} is not available`);
      }
      return requestedModel;
    }

    // Auto-select vision model if images are present and no specific model requested
    if ((IS_AUTO_MODE || !requestedModel) && hasImages) {
      // Check if DEFAULT_VISION_MODEL is available
      const availableModels = await modelProviderRegistry.getAvailableModels(true);
      if (availableModels.includes(DEFAULT_VISION_MODEL)) {
        logger.info(`Auto-selecting vision model for image analysis: ${DEFAULT_VISION_MODEL}`);
        return DEFAULT_VISION_MODEL;
      }
      // Fallback to vision-capable models
      const visionModels = [
        'openai/gpt-4o',
        'openai/gpt-4o-mini', 
        'anthropic/claude-3-sonnet',
        'google/gemini-2.5-pro-preview',
        'meta-llama/llama-4-maverick-17b-instruct'
      ];
      for (const model of visionModels) {
        if (availableModels.includes(model)) {
          logger.info(`Auto-selecting available vision model: ${model}`);
          return model;
        }
      }
    }

    // In auto mode, let the system choose based on tool category
    if (IS_AUTO_MODE || !requestedModel) {
      return this.selectBestModel(hasImages);
    }

    return requestedModel;
  }

  /**
   * Select the best model based on tool category
   */
  private async selectBestModel(hasImages?: boolean): Promise<string> {
    const availableModels = await modelProviderRegistry.getAvailableModels(true);
    
    if (availableModels.length === 0) {
      throw new Error('No models available');
    }

    // If images are present, prefer vision-capable models first
    if (hasImages) {
      // Check if DEFAULT_VISION_MODEL is available
      if (availableModels.includes(DEFAULT_VISION_MODEL)) {
        logger.info(`Auto-selecting vision model for image analysis: ${DEFAULT_VISION_MODEL}`);
        return DEFAULT_VISION_MODEL;
      }
      // Fallback to vision-capable models
      const visionModels = [
        'openai/gpt-4o',
        'openai/gpt-4o-mini', 
        'anthropic/claude-3-sonnet',
        'google/gemini-2.5-pro-preview',
        'meta-llama/llama-4-maverick-17b-instruct'
      ];
      for (const model of visionModels) {
        if (availableModels.includes(model)) {
          logger.info(`Auto-selecting available vision model: ${model}`);
          return model;
        }
      }
    }

    // Tool category preferences
    switch (this.modelCategory) {
      case 'fast':
        // Prefer fast models
        const fastModels = ['flash', 'gemini-2.5-flash-preview-05-20', 'o3-mini', 'o4-mini'];
        for (const model of fastModels) {
          if (availableModels.includes(model)) return model;
        }
        break;
        
      case 'reasoning':
        // Prefer reasoning models
        const reasoningModels = ['pro', 'gemini-2.5-pro-preview-06-05', 'o3', 'o3-pro', 'o4-mini-high'];
        for (const model of reasoningModels) {
          if (availableModels.includes(model)) return model;
        }
        break;
        
      case 'vision':
        // Always prefer vision models for vision tools
        const visionModels = [
          DEFAULT_VISION_MODEL,
          'openai/gpt-4o',
          'openai/gpt-4o-mini',
          'anthropic/claude-3-sonnet',
          'google/gemini-2.5-pro-preview',
          'meta-llama/llama-4-maverick-17b-instruct'
        ];
        for (const model of visionModels) {
          if (availableModels.includes(model)) {
            logger.info(`Vision tool selecting vision model: ${model}`);
            return model;
          }
        }
        break;
        
      case 'all':
        // No preference, use default
        break;
    }

    // Fallback hierarchy - try Claude Sonnet variants first, then others
    const fallbackModels = [
      'anthropic/claude-3-sonnet',
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3-haiku',
      'pro',
      'gemini-2.5-pro-preview-06-05',
      'flash',
      'gemini-2.5-flash-preview-05-20',
      'o3',
      'o4-mini'
    ];
    
    for (const model of fallbackModels) {
      if (availableModels.includes(model)) return model;
    }

    // Final fallback to first available model
    return availableModels[0] || 'anthropic/claude-3-sonnet';
  }

  /**
   * Format output with standard structure
   */
  protected formatOutput(
    content: string,
    status: ToolOutput['status'] = 'success',
    contentType: ToolOutput['content_type'] = 'text',
    metadata?: Record<string, any>,
    continuationOffer?: ContinuationOffer | null,
  ): ToolOutput {
    return {
      status,
      content,
      content_type: contentType,
      metadata,
      continuation_offer: continuationOffer,
    };
  }

  /**
   * Create a model request with conversation context
   */
  protected async createModelRequest(
    prompt: string,
    systemPrompt: string,
    model: string,
    temperature?: number,
    useWebsearch?: boolean,
    conversationContext?: string,
    maxTokens?: number,
  ): Promise<ModelRequest> {
    const messages: Message[] = [];

    // Add conversation context if continuing a thread
    if (conversationContext) {
      messages.push({
        role: 'system',
        content: 'Previous conversation context:\n' + conversationContext,
      });
    }

    // Add web search instructions if enabled
    if (useWebsearch) {
      messages.push({
        role: 'system',
        content: 'You can suggest web searches when current information would be helpful. ' +
                'Format: "I would benefit from searching for: [specific query]"',
      });
    }

    // Add user prompt
    messages.push({
      role: 'user',
      content: prompt,
    });

    return {
      model,
      messages,
      temperature,
      maxTokens,
      systemPrompt,
    };
  }

  /**
   * Handle conversation threading with file tracking
   * 
   * This method now captures the files used during tool execution and stores them
   * in conversation turns to enable the newest-first file prioritization and 
   * token-aware file management features.
   */
  protected async handleConversationThreading(
    toolName: string,
    userPrompt: string,
    assistantResponse: string,
    modelUsed: string,
    inputTokens: number,
    outputTokens: number,
    continuationId?: string,
    userFiles?: string[], // Files provided by user in this turn
    processedFiles?: string[], // Files actually processed by the tool
    originalArgs?: Record<string, any>, // zen compatibility: original request for thread creation
  ): Promise<ContinuationOffer | null> {
    try {
      let threadId: string;

      if (continuationId) {
        // Continue existing thread
        threadId = continuationId;
        await addTurn(threadId, 'user', userPrompt, { 
          inputTokens, 
          tool: toolName, 
          files: userFiles, // Track files provided by user
        });
        await addTurn(threadId, 'assistant', assistantResponse, { 
          modelName: modelUsed, 
          outputTokens, 
          tool: toolName,
          files: processedFiles, // Track files actually processed by tool
        });
      } else {
        // Create new thread (zen-compatible with initial request context)
        threadId = await createThread(toolName, originalArgs || {});
        await addTurn(threadId, 'user', userPrompt, { 
          inputTokens, 
          tool: toolName, 
          files: userFiles, // Track files provided by user
        });
        await addTurn(threadId, 'assistant', assistantResponse, { 
          modelName: modelUsed, 
          outputTokens, 
          tool: toolName,
          files: processedFiles, // Track files actually processed by tool
        });
      }

      // Get conversation stats
      const stats = await getConversationStats(threadId);
      if (!stats) return null;

      // Generate continuation suggestions based on tool
      const suggestions = this.generateContinuationSuggestions(toolName);

      return {
        thread_id: threadId,
        suggestions,
        stats,
      };
    } catch (error) {
      logger.error('Failed to handle conversation threading:', error);
      return null;
    }
  }

  /**
   * Generate continuation suggestions based on tool type
   */
  private generateContinuationSuggestions(toolName: string): string[] {
    switch (toolName) {
      case 'chat':
        return [
          'Continue our discussion',
          'Explore related topics',
          'Ask follow-up questions',
        ];
      case 'thinkdeep':
        return [
          'Dive deeper into specific aspects',
          'Explore alternative approaches',
          'Challenge the assumptions',
        ];
      case 'codereview':
        return [
          'Review additional files',
          'Focus on specific issues found',
          'Suggest improvements',
        ];
      case 'debug':
        return [
          'Try suggested solutions',
          'Investigate related errors',
          'Examine system state',
        ];
      case 'analyze':
        return [
          'Analyze related components',
          'Deep dive into findings',
          'Compare with alternatives',
        ];
      case 'precommit':
        return [
          'Review specific changes',
          'Check additional criteria',
          'Validate fixes',
        ];
      case 'testgen':
        return [
          'Generate more test cases',
          'Add edge case tests',
          'Create integration tests',
        ];
      default:
        return [
          'Continue the conversation',
          'Ask follow-up questions',
          'Explore related topics',
        ];
    }
  }

  /**
   * Read files with security checks
   */
  protected async readFilesSecurely(filePaths: string[]): Promise<Record<string, string>> {
    const fileContents: Record<string, string> = {};
    
    for (const filePath of filePaths) {
      try {
        const translatedPath = translatePathForEnvironment(filePath);
        const content = await readFile(translatedPath);
        fileContents[filePath] = content;
      } catch (error) {
        logger.warn(`Failed to read file ${filePath}:`, error);
        fileContents[filePath] = `Error reading file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }
    
    return fileContents;
  }

  /**
   * Auto-detect and read files mentioned in the prompt
   */
  protected async autoReadFilesFromPrompt(prompt: string): Promise<Record<string, string>> {
    logger.info(`Auto file reading called with prompt length: ${prompt.length}`);
    
    // Extract file paths from prompt using various patterns
    const filePathPatterns = [
      // Absolute paths: /path/to/file.ext
      /\/[\w\-\.\/]+\.[\w]+/g,
      // Relative paths: ./path/to/file.ext or ../path/to/file.ext
      /\.\.?\/[\w\-\.\/]+\.[\w]+/g,
      // Files mentioned in quotes: "src/file.ts" or 'components/Button.jsx'
      /["']([\w\-\.\/]+\.[\w]+)["']/g,
      // Files mentioned with backticks: `src/file.ts`
      /`([\w\-\.\/]+\.[\w]+)`/g,
    ];

    const detectedFiles = new Set<string>();
    
    for (const pattern of filePathPatterns) {
      const matches = prompt.matchAll(pattern);
      for (const match of matches) {
        const filePath = match[1] || match[0]; // Use capture group if available, otherwise full match
        // Only include common code file extensions
        if (this.isLikelyCodeFile(filePath)) {
          detectedFiles.add(filePath.trim());
        }
      }
    }

    if (detectedFiles.size > 0) {
      logger.info(`Auto-detected ${detectedFiles.size} files in prompt: ${Array.from(detectedFiles).join(', ')}`);
      return await this.readFilesSecurely(Array.from(detectedFiles));
    }

    logger.info('No files auto-detected in prompt');
    return {};
  }

  /**
   * Check if a file path looks like a code file we should auto-read
   */
  private isLikelyCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt', '.yaml', '.yml',
      '.css', '.scss', '.html', '.xml', '.py', '.java', '.go', '.rs', '.rb',
      '.php', '.swift', '.kt', '.scala', '.sql', '.sh', '.bash', '.env'
    ];
    
    const ext = filePath.toLowerCase().split('.').pop();
    return ext ? codeExtensions.includes(`.${ext}`) : false;
  }

  /**
   * Check if prompt exceeds MCP limits
   */
  protected checkPromptSize(prompt: string): void {
    if (prompt.length > MCP_PROMPT_SIZE_LIMIT) {
      throw new Error(
        `Prompt exceeds MCP protocol limit of ${MCP_PROMPT_SIZE_LIMIT} characters. ` +
        'Please provide large content as file references instead.',
      );
    }
  }

  /**
   * Get model description for input schema
   */
  protected getModelDescription(): string {
    if (IS_AUTO_MODE) {
      const descriptions = Object.entries(MODEL_CAPABILITIES_DESC)
        .map(([model, desc]) => `- ${model}: ${desc}`)
        .join('\n');
      
      return `Model to use. In auto mode, the best model will be selected based on task requirements:\n${descriptions}`;
    } else {
      return `Model to use. Default: ${DEFAULT_MODEL}`;
    }
  }

  /**
   * Estimate tokens for a file using file-type aware ratios.
   *
   * @param filePath Path to the file
   * @returns Estimated token count
   */
  protected async estimateTokensSmart(filePath: string): Promise<number> {
    return await estimateFileTokens(filePath);
  }

  /**
   * Check if total file sizes would exceed token threshold before embedding.
   *
   * IMPORTANT: This performs STRICT REJECTION at MCP boundary.
   * No partial inclusion - either all files fit or request is rejected.
   * This forces Claude to make better file selection decisions.
   *
   * @param files List of file paths to check
   * @param modelName Current model name for context-aware thresholds
   * @returns MCP_CODE_TOO_LARGE response if too large, null if acceptable
   */
  protected async checkTotalFileSize(
    files: string[],
    modelName?: string,
  ): Promise<{ status: 'MCP_CODE_TOO_LARGE'; content: string; content_type: 'text' } | null> {
    if (!files || files.length === 0) {
      return null;
    }

    // Use the current model or fallback to default
    const currentModel = modelName || DEFAULT_MODEL;

    // Use centralized file size checking with model context
    return await checkTotalFileSize(files, currentModel);
  }

  /**
   * Validate image limits at MCP boundary with model capability checking.
   * 
   * This performs strict validation to ensure we don't exceed model-specific
   * image size limits and that the model supports images at all.
   *
   * @param images List of image paths/data URLs to validate
   * @param modelName Name of the model to check limits against
   * @returns Error response if validation fails, null if valid
   */
  protected async validateImageLimits(
    images: string[] | undefined,
    modelName: string
  ): Promise<ToolOutput | null> {
    if (!images?.length) {
      return null;
    }

    try {
      logger.debug(`[IMAGE_VALIDATION] Validating ${images.length} images for model ${modelName}`);
      
      // Get model provider to check image capabilities
      const provider = await modelProviderRegistry.getProviderForModel(modelName);
      if (!provider) {
        return this.formatOutput(
          `Model ${modelName} is not available. Please check your configuration.`,
          'error'
        );
      }

      // Get image capabilities for this model
      const capabilities = await provider.getImageCapabilities(modelName);
      
      // Validate images against capabilities
      const validation = await validateImages(images, capabilities);
      
      if (!validation.valid) {
        return this.formatOutput(
          `Image validation failed: ${validation.error}`,
          'error'
        );
      }

      logger.debug(`[IMAGE_VALIDATION] All images valid for model ${modelName}`);
      return null;
    } catch (error) {
      logger.error(`[IMAGE_VALIDATION] Error validating images:`, error);
      return this.formatOutput(
        `Failed to validate images: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }
}