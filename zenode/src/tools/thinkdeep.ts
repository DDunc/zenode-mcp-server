/**
 * ThinkDeep tool - Extended reasoning and problem-solving
 * 
 * This tool provides deep analysis for complex problems, acting as a senior
 * engineering collaborator to deepen, validate, and extend Claude's thinking
 * on architecture decisions, complex bugs, performance challenges, and security analysis.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { 
  ThinkDeepRequest, 
  ToolOutput, 
  ToolModelCategory,
  ThinkingModeSchema,
} from '../types/tools.js';
import { THINKDEEP_PROMPT } from '../systemprompts/thinkdeep-prompt.js';
import { 
  TEMPERATURE_CREATIVE, 
  DEFAULT_THINKING_MODE_THINKDEEP,
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
const ThinkDeepRequestSchema = z.object({
  prompt: z.string(),
  model: z.string().optional(),
  problem_context: z.string().optional(),
  focus_areas: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(1).optional(),
  thinking_mode: ThinkingModeSchema.optional(),
  use_websearch: z.boolean().default(true),
  continuation_id: z.string().optional(),
});

export class ThinkDeepTool extends BaseTool {
  name = 'thinkdeep';

  getZodSchema(): z.ZodSchema {
    return ThinkDeepRequestSchema;
  }
  
  description = 
    'EXTENDED THINKING & REASONING - Deep thinking partner for complex problems. ' +
    'IMPORTANT: This tool MUST be used when explicitly invoked (e.g., "zenode:thinkdeep [problem]"). ' +
    'Use this when you need to think deeper about a problem, extend your analysis, explore alternatives, or validate approaches. ' +
    'Perfect for: architecture decisions, complex bugs, performance challenges, security analysis. ' +
    'Will challenge assumptions, find edge cases, and provide alternative solutions. ' +
    'Choose the appropriate thinking_mode based on task complexity - ' +
    '\'low\' for quick analysis, \'medium\' for standard problems, \'high\' for complex issues (default), ' +
    '\'max\' for extremely complex challenges requiring deepest analysis. ' +
    'When in doubt, err on the side of a higher mode for truly deep thought and evaluation. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_CREATIVE;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema(): any {
    const schema = {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Your current thinking/analysis to extend and validate',
        },
        model: {
          type: 'string',
          description: IS_AUTO_MODE 
            ? this.getModelDescription()
            : `Model to use. Default: ${process.env.DEFAULT_MODEL || 'auto'}`,
        },
        problem_context: {
          type: 'string',
          description: 'Additional context about the problem or goal',
        },
        focus_areas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific aspects to focus on (architecture, performance, security, etc.)',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional file paths or directories for additional context (must be absolute paths)',
        },
        temperature: {
          type: 'number',
          description: 'Temperature for creative thinking (0-1, default 0.7)',
          minimum: 0,
          maximum: 1,
        },
        thinking_mode: {
          type: 'string',
          enum: ['minimal', 'low', 'medium', 'high', 'max'],
          description: getThinkingModeDescription(DEFAULT_THINKING_MODE_THINKDEEP),
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
    return THINKDEEP_PROMPT;
  }
  
  async execute(args: ThinkDeepRequest): Promise<ToolOutput> {
    try {
      // Validate request
      const validatedRequest = ThinkDeepRequestSchema.parse(args);
      logger.debug('ThinkDeep request validated', { 
        hasContext: !!validatedRequest.problem_context,
        focusAreas: validatedRequest.focus_areas?.length || 0,
        files: validatedRequest.files?.length || 0,
      });
      
      // Check prompt size
      const sizeCheck = checkPromptSize(validatedRequest.prompt, 'prompt');
      if (sizeCheck) {
        return sizeCheck;
      }
      
      // Prepare the prompt
      const fullPrompt = await this.preparePrompt(validatedRequest);
      
      // Select model
      const model = await this.selectModel(validatedRequest.model);
      
      // Get conversation context if continuing
      let conversationContext: string | undefined;
      if (validatedRequest.continuation_id) {
        // This would be handled by the base class in the real implementation
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
      
      logger.info('Executing ThinkDeep analysis', { model });
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);
      
      // Format the response with the critical evaluation template
      const formattedResponse = this.formatResponse(response.content, validatedRequest, response.modelName);
      
      // Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validatedRequest.prompt,
        formattedResponse,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validatedRequest.continuation_id,
      );
      
      return this.formatOutput(
        formattedResponse,
        'success',
        'text',
        {
          model_used: response.modelName,
          token_usage: response.usage,
        },
        continuationOffer,
      );
      
    } catch (error) {
      logger.error('ThinkDeep execution error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request parameters: ${error.errors.map(e => e.message).join(', ')}`,
          'error',
          'text',
        );
      }
      
      return this.formatOutput(
        `Error during analysis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        'text',
      );
    }
  }
  
  private async preparePrompt(request: ThinkDeepRequest): Promise<string> {
    const contextParts: string[] = [];
    
    // Add current analysis
    contextParts.push(
      `=== CLAUDE'S CURRENT ANALYSIS ===\n${request.prompt}\n=== END ANALYSIS ===`
    );
    
    // Add problem context if provided
    if (request.problem_context) {
      contextParts.push(
        `\n=== PROBLEM CONTEXT ===\n${request.problem_context}\n=== END CONTEXT ===`
      );
    }
    
    // Add files if provided
    if (request.files && request.files.length > 0) {
      // In the real implementation, this would read and format files
      const fileContent = await this.readFilesSecurely(request.files);
      const formattedFiles = Object.entries(fileContent)
        .map(([path, content]) => `File: ${path}\n${content}`)
        .join('\n\n');
      
      if (formattedFiles) {
        contextParts.push(
          `\n=== REFERENCE FILES ===\n${formattedFiles}\n=== END FILES ===`
        );
      }
    }
    
    const fullContext = contextParts.join('\n');
    
    // Add focus areas instruction if specified
    let focusInstruction = '';
    if (request.focus_areas && request.focus_areas.length > 0) {
      const areas = request.focus_areas.join(', ');
      focusInstruction = `\n\nFOCUS AREAS: Please pay special attention to ${areas} aspects.`;
    }
    
    // Add web search instruction if enabled
    const websearchInstruction = buildWebSearchInstruction(
      request.use_websearch !== false,
      `When analyzing complex problems, consider if searches for these would help:
- Current documentation for specific technologies, frameworks, or APIs mentioned
- Known issues, workarounds, or community solutions for similar problems
- Recent updates, deprecations, or best practices that might affect the approach
- Official sources to verify assumptions or clarify technical details`
    );
    
    // Combine everything
    const fullPrompt = `${this.getSystemPrompt()}${focusInstruction}${websearchInstruction}

${fullContext}

Please provide deep analysis that extends Claude's thinking with:
1. Alternative approaches and solutions
2. Edge cases and potential failure modes
3. Critical evaluation of assumptions
4. Concrete implementation suggestions
5. Risk assessment and mitigation strategies`;
    
    return fullPrompt;
  }
  
  private formatResponse(response: string, request: ThinkDeepRequest, modelName: string): string {
    // Format the model name for display
    const displayModelName = modelName || 'your fellow developer';
    
    return `${response}

---

## Critical Evaluation Required

Claude, please critically evaluate ${displayModelName}'s analysis by thinking hard about the following:

1. **Technical merit** - Which suggestions are valuable vs. have limitations?
2. **Constraints** - Fit with codebase patterns, performance, security, architecture
3. **Risks** - Hidden complexities, edge cases, potential failure modes
4. **Final recommendation** - Synthesize both perspectives, then ultrathink on your own to explore additional
considerations and arrive at the best technical solution. Feel free to use zen's chat tool for a follow-up discussion
if needed.

Remember: Use ${displayModelName}'s insights to enhance, not replace, your analysis.`;
  }
}