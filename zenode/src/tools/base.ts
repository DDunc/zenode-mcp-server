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
import { ModelProvider, ModelRequest, Message } from '../types/providers.js';
import { modelProviderRegistry } from '../providers/registry.js';
import { 
  DEFAULT_MODEL, 
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
import { readFile, translatePathForEnvironment } from '../utils/file-utils.js';

/**
 * Base request schema with common fields
 */
export const BaseRequestSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().optional(),
  thinking_mode: z.enum(['minimal', 'low', 'medium', 'high', 'max']).optional(),
  use_websearch: z.boolean().default(true),
  continuation_id: z.string().optional(),
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
   * Get the JSON Schema for this tool's input
   */
  abstract getInputSchema(): any;

  /**
   * Get the system prompt for this tool
   */
  abstract getSystemPrompt(): string;

  /**
   * Execute the tool with given arguments
   */
  abstract execute(args: ToolRequest): Promise<ToolOutput>;

  /**
   * Select the best model for this request
   */
  protected async selectModel(
    requestedModel: string | undefined,
    provider?: ModelProvider,
  ): Promise<string> {
    // If a specific model is requested, validate and use it
    if (requestedModel && !IS_AUTO_MODE) {
      const capabilities = await modelProviderRegistry.getModelCapabilities(requestedModel);
      if (!capabilities) {
        throw new Error(`Model ${requestedModel} is not available`);
      }
      return requestedModel;
    }

    // In auto mode, let the system choose based on tool category
    if (IS_AUTO_MODE || !requestedModel) {
      return this.selectBestModel();
    }

    return requestedModel;
  }

  /**
   * Select the best model based on tool category
   */
  private async selectBestModel(): Promise<string> {
    const availableModels = await modelProviderRegistry.getAvailableModels(true);
    
    if (availableModels.length === 0) {
      throw new Error('No models available');
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
        
      case 'all':
        // No preference, use default
        break;
    }

    // Fallback to first available model
    return availableModels[0] || 'gemini-2.5-flash-preview-05-20';
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
   * Handle conversation threading
   */
  protected async handleConversationThreading(
    toolName: string,
    userPrompt: string,
    assistantResponse: string,
    modelUsed: string,
    inputTokens: number,
    outputTokens: number,
    continuationId?: string,
  ): Promise<ContinuationOffer | null> {
    try {
      let threadId: string;

      if (continuationId) {
        // Continue existing thread
        threadId = continuationId;
        await addTurn(threadId, 'user', userPrompt, { inputTokens, tool: toolName });
        await addTurn(threadId, 'assistant', assistantResponse, { modelName: modelUsed, outputTokens, tool: toolName });
      } else {
        // Create new thread
        threadId = await createThread(toolName, modelUsed);
        await addTurn(threadId, 'user', userPrompt, { inputTokens, tool: toolName });
        await addTurn(threadId, 'assistant', assistantResponse, { modelName: modelUsed, outputTokens, tool: toolName });
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
}