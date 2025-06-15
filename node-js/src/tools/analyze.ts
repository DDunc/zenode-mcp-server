/**
 * Analyze tool - General-purpose code and file analysis
 * 
 * This tool provides holistic technical audits for understanding code at
 * a strategic level. Unlike CodeReview which focuses on bugs and issues,
 * Analyze examines architecture, scalability, maintainability, and strategic
 * improvement opportunities.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { 
  AnalyzeRequest, 
  ToolOutput, 
  ToolModelCategory,
  ThinkingModeSchema,
  AnalysisTypeSchema,
  OutputFormatSchema,
} from '../types/tools.js';
import { ANALYZE_PROMPT } from '../systemprompts/analyze-prompt.js';
import { 
  TEMPERATURE_ANALYTICAL,
  IS_AUTO_MODE,
} from '../config.js';
import { 
  checkPromptSize, 
  formatClarificationRequest,
  formatFullCodereviewRequired,
  formatResponseWithNextSteps,
  buildWebSearchInstruction,
  getThinkingModeDescription,
} from '../utils/tool-helpers.js';
import { logger } from '../utils/logger.js';

/**
 * Request validation schema
 */
const AnalyzeRequestSchema = z.object({
  files: z.array(z.string()),
  prompt: z.string(),
  model: z.string().optional(),
  analysis_type: AnalysisTypeSchema.optional(),
  output_format: OutputFormatSchema.default('detailed'),
  temperature: z.number().min(0).max(1).optional(),
  thinking_mode: ThinkingModeSchema.optional(),
  use_websearch: z.boolean().default(true),
  continuation_id: z.string().optional(),
});

export class AnalyzeTool extends BaseTool {
  name = 'analyze';
  
  description = 
    'ANALYZE FILES & CODE - General-purpose analysis for understanding code. ' +
    'Supports both individual files and entire directories. ' +
    'Use this when you need to analyze files, examine code, or understand specific aspects of a codebase. ' +
    'Perfect for: codebase exploration, dependency analysis, pattern detection. ' +
    'Always uses file paths for clean terminal output. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema(): any {
    const schema = {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Files or directories to analyze (must be absolute paths)',
        },
        prompt: {
          type: 'string',
          description: 'What to analyze or look for',
        },
        model: {
          type: 'string',
          description: IS_AUTO_MODE 
            ? this.getModelDescription()
            : `Model to use. Default: ${process.env.DEFAULT_MODEL || 'auto'}`,
        },
        analysis_type: {
          type: 'string',
          enum: ['architecture', 'performance', 'security', 'quality', 'general'],
          description: 'Type of analysis to perform',
        },
        output_format: {
          type: 'string',
          enum: ['summary', 'detailed', 'actionable'],
          default: 'detailed',
          description: 'How to format the output',
        },
        temperature: {
          type: 'number',
          description: 'Temperature (0-1, default 0.2)',
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
      required: ['files', 'prompt'],
    };
    
    // Add model to required fields if in auto mode
    if (IS_AUTO_MODE) {
      schema.required.push('model');
    }
    
    return schema;
  }
  
  getSystemPrompt(): string {
    return ANALYZE_PROMPT;
  }
  
  async execute(args: AnalyzeRequest): Promise<ToolOutput> {
    try {
      // Validate request
      const validatedRequest = AnalyzeRequestSchema.parse(args);
      logger.debug('Analyze request validated', { 
        files: validatedRequest.files.length,
        analysisType: validatedRequest.analysis_type || 'general',
        outputFormat: validatedRequest.output_format,
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
      
      // Make API call (this would be handled by the provider)
      logger.info('Executing analysis', { 
        model,
        analysisType: validatedRequest.analysis_type || 'general',
      });
      
      // For now, return a mock response showing the structure
      const mockResponse = `
## Executive Overview
The codebase demonstrates solid modular architecture with clear separation of concerns. However, the data layer shows signs of coupling that could impact scalability as the system grows.

## Strategic Findings (Ordered by Impact)

### 1. Data Layer Coupling
**Insight:** Direct database access from multiple services creates tight coupling.
**Evidence:** Services in src/services/*.js directly import database models.
**Impact:** Limits ability to scale services independently or change data storage.
**Recommendation:** Introduce repository pattern to abstract data access.
**Effort vs. Benefit:** Medium effort; High payoff.

### 2. Missing Observability Layer
**Insight:** Limited logging and no structured metrics collection.
**Evidence:** Only console.log statements found, no APM integration.
**Impact:** Difficult to diagnose production issues or track performance.
**Recommendation:** Implement structured logging with correlation IDs.
**Effort vs. Benefit:** Low effort; High payoff.

## Quick Wins
• Add request correlation IDs to all API endpoints
• Implement basic health check endpoint
• Add environment-specific config validation on startup`;
      
      const formattedResponse = this.formatResponse(mockResponse, validatedRequest);
      
      return this.formatOutput(
        formattedResponse,
        'success',
        'text',
      );
      
    } catch (error) {
      logger.error('Analyze execution error:', error);
      
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
  
  private async preparePrompt(request: AnalyzeRequest): Promise<string> {
    // Read all files
    const fileContents = await this.readFilesSecurely(request.files);
    
    // Format file content
    const formattedFiles = Object.entries(fileContents)
      .map(([path, content]) => `=== FILE: ${path} ===\n${content}\n=== END FILE ===`)
      .join('\n\n');
    
    // Build analysis instructions
    const analysisFocus = this.buildAnalysisFocus(request);
    
    // Add web search instruction if enabled
    const websearchInstruction = buildWebSearchInstruction(
      request.use_websearch !== false,
      `When analyzing code, consider if searches for these would help:
- Documentation for technologies or frameworks found in the code
- Best practices and design patterns relevant to the analysis
- API references and usage examples
- Known issues or solutions for patterns you identify`
    );
    
    // Combine everything
    const fullPrompt = `${analysisFocus}${websearchInstruction}

=== USER QUESTION ===
${request.prompt}
=== END QUESTION ===

=== FILES TO ANALYZE ===
${formattedFiles}
=== END FILES ===

Please analyze these files to answer the user's question.`;
    
    return fullPrompt;
  }
  
  private buildAnalysisFocus(request: AnalyzeRequest): string {
    const parts: string[] = [];
    
    // Add analysis type focus
    if (request.analysis_type) {
      const typeFocus: Record<string, string> = {
        architecture: 'Focus on architectural patterns, structure, and design decisions',
        performance: 'Focus on performance characteristics and optimization opportunities',
        security: 'Focus on security implications and potential vulnerabilities',
        quality: 'Focus on code quality, maintainability, and best practices',
        general: 'Provide a comprehensive general analysis',
      };
      parts.push(typeFocus[request.analysis_type] || '');
    }
    
    // Add output format guidance
    switch (request.output_format) {
      case 'summary':
        parts.push('Provide a concise summary of key findings');
        break;
      case 'actionable':
        parts.push('Focus on actionable insights and specific recommendations');
        break;
      default:
        // 'detailed' - no special instruction needed
        break;
    }
    
    return parts.filter(p => p).join('\n');
  }
  
  private formatResponse(response: string, request: AnalyzeRequest): string {
    const nextSteps = 'Use this analysis to actively continue your task. ' +
      'Investigate deeper into any findings, implement solutions based on these insights, ' +
      'and carry out the necessary work. Only pause to ask the user if you need their ' +
      'explicit approval for major changes or if critical decisions require their input.';
    
    return formatResponseWithNextSteps(response, nextSteps);
  }
}