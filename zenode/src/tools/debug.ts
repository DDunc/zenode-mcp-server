/**
 * Debug tool - Root cause analysis and debugging assistance
 * 
 * This tool provides expert debugging for complex issues with support for
 * large diagnostic files. It emphasizes finding the minimal fix required
 * to resolve specific issues without suggesting unrelated improvements.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { 
  DebugRequest, 
  ToolOutput, 
  ToolModelCategory,
  ThinkingModeSchema,
} from '../types/tools.js';
import { DEBUG_PROMPT } from '../systemprompts/debug-prompt.js';
import { 
  TEMPERATURE_ANALYTICAL,
  IS_AUTO_MODE,
} from '../config.js';
import { 
  checkPromptSize, 
  formatClarificationRequest,
  buildWebSearchInstruction,
  getThinkingModeDescription,
} from '../utils/tool-helpers.js';
import { logger } from '../utils/logger.js';
import { modelProviderRegistry } from '../providers/registry.js';

/**
 * Request validation schema
 */
const DebugRequestSchema = z.object({
  prompt: z.string(),
  model: z.string().optional(),
  error_context: z.string().optional(),
  files: z.array(z.string()).optional(),
  runtime_info: z.string().optional(),
  previous_attempts: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  thinking_mode: ThinkingModeSchema.optional(),
  use_websearch: z.boolean().default(true),
  continuation_id: z.string().optional(),
});

export class DebugTool extends BaseTool {
  name = 'debug';
  
  description = 
    'DEBUG & ROOT CAUSE ANALYSIS - Expert debugging for complex issues with 1M token capacity. ' +
    'Use this when you need to debug code, find out why something is failing, identify root causes, ' +
    'trace errors, or diagnose issues. ' +
    'IMPORTANT: Share diagnostic files liberally! The model can handle up to 1M tokens, so include: ' +
    'large log files, full stack traces, memory dumps, diagnostic outputs, multiple related files, ' +
    'entire modules, test results, configuration files - anything that might help debug the issue. ' +
    'Claude should proactively use this tool whenever debugging is needed and share comprehensive ' +
    'file paths rather than snippets. Include error messages, stack traces, logs, and ALL relevant ' +
    'code files as absolute paths. The more context, the better the debugging analysis. ' +
    'Choose thinking_mode based on issue complexity: \'low\' for simple errors, ' +
    '\'medium\' for standard debugging (default), \'high\' for complex system issues, ' +
    '\'max\' for extremely challenging bugs requiring deepest analysis. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema(): any {
    const schema = {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Error message, symptoms, or issue description',
        },
        model: {
          type: 'string',
          description: IS_AUTO_MODE 
            ? this.getModelDescription()
            : `Model to use. Default: ${process.env.DEFAULT_MODEL || 'auto'}`,
        },
        error_context: {
          type: 'string',
          description: 'Stack trace, logs, or additional error context',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files or directories that might be related to the issue (must be absolute paths)',
        },
        runtime_info: {
          type: 'string',
          description: 'Environment, versions, or runtime information',
        },
        previous_attempts: {
          type: 'string',
          description: 'What has been tried already',
        },
        temperature: {
          type: 'number',
          description: 'Temperature (0-1, default 0.2 for accuracy)',
          minimum: 0,
          maximum: 1,
        },
        thinking_mode: {
          type: 'string',
          enum: ['minimal', 'low', 'medium', 'high', 'max'],
          description: getThinkingModeDescription(),
        },
        use_websearch: {
          type: 'boolean',
          description: 'Enable web search for documentation, best practices, and current information. Particularly useful for: brainstorming sessions, architectural design discussions, exploring industry best practices, working with specific frameworks/technologies, researching solutions to complex problems, or when current documentation and community insights would enhance the analysis.',
          default: true,
        },
        continuation_id: {
          type: 'string',
          description: 'Thread continuation ID for multi-turn conversations. Can be used to continue conversations across different tools. Only provide this if continuing a previous conversation thread.',
        },
      },
      required: ['prompt'],
    };
    
    // Add model to required fields if in auto mode
    if (IS_AUTO_MODE) {
      schema.required.push('model');
    }
    
    return schema;
  }
  
  getSystemPrompt(): string {
    return DEBUG_PROMPT;
  }
  
  async execute(args: DebugRequest): Promise<ToolOutput> {
    try {
      // Validate request
      const validatedRequest = DebugRequestSchema.parse(args);
      logger.debug('Debug request validated', { 
        hasErrorContext: !!validatedRequest.error_context,
        files: validatedRequest.files?.length || 0,
        hasRuntimeInfo: !!validatedRequest.runtime_info,
        hasPreviousAttempts: !!validatedRequest.previous_attempts,
      });
      
      // Check prompt size
      const promptSizeCheck = checkPromptSize(validatedRequest.prompt, 'prompt');
      if (promptSizeCheck) {
        return promptSizeCheck;
      }
      
      // Check error_context size if provided
      if (validatedRequest.error_context) {
        const contextSizeCheck = checkPromptSize(validatedRequest.error_context, 'error_context');
        if (contextSizeCheck) {
          return contextSizeCheck;
        }
      }
      
      // Prepare the prompt
      const fullPrompt = await this.preparePrompt(validatedRequest);
      
      // Select model
      const model = await this.selectModel(validatedRequest.model);
      
      // Get conversation context if continuing
      let conversationContext: string | undefined;
      if (validatedRequest.continuation_id) {
        logger.info(`Continuing conversation thread: ${validatedRequest.continuation_id}`);
      }
      
      // Create model request
      const modelRequest = await this.createModelRequest(
        fullPrompt,
        this.getSystemPrompt(),
        model,
        validatedRequest.temperature || this.defaultTemperature,
        validatedRequest.use_websearch,
        conversationContext,
      );
      
      // Get provider and make actual API call
      const provider = await modelProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new Error(`No provider available for model: ${model}`);
      }
      
      logger.info('Executing debug analysis', { model });
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);
      
      // Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validatedRequest.prompt,
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validatedRequest.continuation_id,
      );
      
      return this.formatOutput(
        response.content,
        'success',
        'text',
        {
          model_used: response.modelName,
          token_usage: response.usage,
        },
        continuationOffer,
      );
      
    } catch (error) {
      logger.error('Debug execution error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request parameters: ${error.errors.map(e => e.message).join(', ')}`,
          'error',
          'text',
        );
      }
      
      return this.formatOutput(
        `Error during debugging: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        'text',
      );
    }
  }
  
  private async preparePrompt(request: DebugRequest): Promise<string> {
    const contextParts: string[] = [];
    
    // Add issue description
    contextParts.push(
      `=== ISSUE DESCRIPTION ===\n${request.prompt}\n=== END DESCRIPTION ===`
    );
    
    // Add error context if provided
    if (request.error_context) {
      contextParts.push(
        `\n=== ERROR CONTEXT/STACK TRACE ===\n${request.error_context}\n=== END CONTEXT ===`
      );
    }
    
    // Add runtime info if provided
    if (request.runtime_info) {
      contextParts.push(
        `\n=== RUNTIME INFORMATION ===\n${request.runtime_info}\n=== END RUNTIME ===`
      );
    }
    
    // Add previous attempts if provided
    if (request.previous_attempts) {
      contextParts.push(
        `\n=== PREVIOUS ATTEMPTS ===\n${request.previous_attempts}\n=== END ATTEMPTS ===`
      );
    }
    
    // Add relevant files if provided
    if (request.files && request.files.length > 0) {
      const fileContents = await this.readFilesSecurely(request.files);
      const formattedFiles = Object.entries(fileContents)
        .map(([path, content]) => `=== FILE: ${path} ===\n${content}\n=== END FILE ===`)
        .join('\n\n');
      
      if (formattedFiles) {
        contextParts.push(
          `\n=== RELEVANT CODE ===\n${formattedFiles}\n=== END CODE ===`
        );
      }
    }
    
    const fullContext = contextParts.join('\n');
    
    // Add web search instruction if enabled
    const websearchInstruction = buildWebSearchInstruction(
      request.use_websearch !== false,
      `When debugging issues, consider if searches for these would help:
- The exact error message to find known solutions
- Framework-specific error codes and their meanings
- Similar issues in forums, GitHub issues, or Stack Overflow
- Workarounds and patches for known bugs
- Version-specific issues and compatibility problems`
    );
    
    // Combine everything
    const fullPrompt = `${websearchInstruction}

${fullContext}

Please analyze this issue and provide root cause analysis with minimal fixes.`;
    
    return fullPrompt;
  }
}