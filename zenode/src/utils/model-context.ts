/**
 * Model context management for dynamic token allocation.
 *
 * This module provides a clean abstraction for model-specific token management,
 * ensuring that token limits are properly calculated based on the current model
 * being used, not global constants.
 */

import { logger } from './logger.js';
import { DEFAULT_MODEL } from '../config.js';
import { ModelCapabilities } from '../types/providers.js';
import { modelProviderRegistry } from '../providers/registry.js';

/**
 * Token allocation strategy for a model.
 */
export interface TokenAllocation {
  /** Total token capacity for the model */
  totalTokens: number;
  /** Tokens allocated for content (files + history + prompt) */
  contentTokens: number;
  /** Tokens reserved for model response */
  responseTokens: number;
  /** Tokens allocated for file content */
  fileTokens: number;
  /** Tokens allocated for conversation history */
  historyTokens: number;
}

/**
 * Helper functions for token allocation
 */
export class TokenAllocationHelper {
  /**
   * Get tokens available for the actual prompt after allocations.
   */
  static getAvailableForPrompt(allocation: TokenAllocation): number {
    return allocation.contentTokens - allocation.fileTokens - allocation.historyTokens;
  }
}

/**
 * Encapsulates model-specific information and token calculations.
 *
 * This class provides a single source of truth for all model-related
 * token calculations, ensuring consistency across the system.
 *
 * CONVERSATION MEMORY INTEGRATION:
 * This module works closely with the conversation memory system to provide
 * optimal token allocation for multi-turn conversations:
 *
 * 1. DUAL PRIORITIZATION STRATEGY SUPPORT:
 *    - Provides separate token budgets for conversation history vs. files
 *    - Enables the conversation memory system to apply newest-first prioritization
 *    - Ensures optimal balance between context preservation and new content
 *
 * 2. MODEL-SPECIFIC ALLOCATION:
 *    - Dynamic allocation based on model capabilities (context window size)
 *    - Conservative allocation for smaller models (O3: 200K context)
 *    - Generous allocation for larger models (Gemini: 1M+ context)
 *    - Adapts token distribution ratios based on model capacity
 *
 * 3. CROSS-TOOL CONSISTENCY:
 *    - Provides consistent token budgets across different tools
 *    - Enables seamless conversation continuation between tools
 *    - Supports conversation reconstruction with proper budget management
 */
export class ModelContext {
  private _provider: any = null;
  private _capabilities: ModelCapabilities | null = null;
  private _tokenAllocation: TokenAllocation | null = null;

  constructor(
    public readonly modelName: string, 
    public readonly modelOption?: string // zen compatibility: for consensus tool stance options
  ) {}

  /**
   * Get the model provider lazily.
   */
  async getProvider(): Promise<any> {
    if (!this._provider) {
      this._provider = await modelProviderRegistry.getProviderForModel(this.modelName);
      if (!this._provider) {
        throw new Error(`No provider found for model: ${this.modelName}`);
      }
    }
    return this._provider;
  }

  /**
   * Get model capabilities lazily.
   */
  async getCapabilities(): Promise<ModelCapabilities> {
    if (!this._capabilities) {
      const provider = await this.getProvider();
      this._capabilities = provider.getModelCapabilities(this.modelName);
      if (!this._capabilities) {
        throw new Error(`No capabilities found for model: ${this.modelName}`);
      }
    }
    return this._capabilities;
  }

  /**
   * Calculate token allocation based on model capacity and conversation requirements.
   *
   * This method implements the core token budget calculation that supports the
   * dual prioritization strategy used in conversation memory and file processing:
   *
   * TOKEN ALLOCATION STRATEGY:
   * 1. CONTENT vs RESPONSE SPLIT:
   *    - Smaller models (< 300K): 60% content, 40% response (conservative)
   *    - Larger models (≥ 300K): 80% content, 20% response (generous)
   *
   * 2. CONTENT SUB-ALLOCATION:
   *    - File tokens: 30-40% of content budget for newest file versions
   *    - History tokens: 40-50% of content budget for conversation context
   *    - Remaining: Available for tool-specific prompt content
   *
   * 3. CONVERSATION MEMORY INTEGRATION:
   *    - History allocation enables conversation reconstruction in reconstructThreadContext()
   *    - File allocation supports newest-first file prioritization in tools
   *    - Remaining budget passed to tools via _remaining_tokens parameter
   *
   * @param reservedForResponse - Override response token reservation
   * @returns TokenAllocation with calculated budgets for dual prioritization strategy
   */
  async calculateTokenAllocation(reservedForResponse?: number): Promise<TokenAllocation> {
    const capabilities = await this.getCapabilities();
    const totalTokens = capabilities.contextWindow;

    // Dynamic allocation based on model capacity
    let contentRatio: number;
    let responseRatio: number;
    let fileRatio: number;
    let historyRatio: number;

    if (totalTokens < 300_000) {
      // Smaller context models (O3): Conservative allocation
      contentRatio = 0.6; // 60% for content
      responseRatio = 0.4; // 40% for response
      fileRatio = 0.3; // 30% of content for files
      historyRatio = 0.5; // 50% of content for history
    } else {
      // Larger context models (Gemini): More generous allocation
      contentRatio = 0.8; // 80% for content
      responseRatio = 0.2; // 20% for response
      fileRatio = 0.4; // 40% of content for files
      historyRatio = 0.4; // 40% of content for history
    }

    // Calculate allocations
    const contentTokens = Math.floor(totalTokens * contentRatio);
    const responseTokens = reservedForResponse || Math.floor(totalTokens * responseRatio);

    // Sub-allocations within content budget
    const fileTokens = Math.floor(contentTokens * fileRatio);
    const historyTokens = Math.floor(contentTokens * historyRatio);

    const allocation: TokenAllocation = {
      totalTokens,
      contentTokens,
      responseTokens,
      fileTokens,
      historyTokens,
    };

    logger.debug(`Token allocation for ${this.modelName}:`);
    logger.debug(`  Total: ${allocation.totalTokens.toLocaleString()}`);
    logger.debug(`  Content: ${allocation.contentTokens.toLocaleString()} (${Math.round(contentRatio * 100)}%)`);
    logger.debug(`  Response: ${allocation.responseTokens.toLocaleString()} (${Math.round(responseRatio * 100)}%)`);
    logger.debug(
      `  Files: ${allocation.fileTokens.toLocaleString()} (${Math.round(fileRatio * 100)}% of content)`,
    );
    logger.debug(
      `  History: ${allocation.historyTokens.toLocaleString()} (${Math.round(historyRatio * 100)}% of content)`,
    );

    this._tokenAllocation = allocation;
    return allocation;
  }

  /**
   * Estimate token count for text using model-specific tokenizer.
   *
   * For now, uses simple estimation. Can be enhanced with model-specific
   * tokenizers (tiktoken for OpenAI, etc.) in the future.
   *
   * @param text - Text to estimate tokens for
   * @returns Estimated token count
   */
  estimateTokens(text: string): number {
    // TODO: Integrate model-specific tokenizers
    // For now, use conservative estimation (zen pattern: integer division)
    return Math.floor(text.length / 3); // Conservative estimate, matches zen pattern
  }

  /**
   * Create ModelContext from tool arguments.
   *
   * @param arguments - Tool arguments containing optional model parameter
   * @returns New ModelContext instance
   */
  static fromArguments(args: Record<string, any>): ModelContext {
    const modelName = args.model || DEFAULT_MODEL;
    
    // Handle auto mode - use fallback model for context calculations
    if (modelName.toLowerCase() === 'auto') {
      logger.warn('Creating ModelContext with auto mode - using fallback model for context calculations');
      // Use a reasonable fallback model for token calculations
      // This won't be used for actual generation, just for context size estimation
      const fallbackModel = 'anthropic/claude-3-sonnet';
      return new ModelContext(fallbackModel);
    }
    
    return new ModelContext(modelName);
  }

  /**
   * Get cached token allocation if available, otherwise calculate it.
   */
  async getTokenAllocation(): Promise<TokenAllocation> {
    if (!this._tokenAllocation) {
      await this.calculateTokenAllocation();
    }
    return this._tokenAllocation!;
  }
}