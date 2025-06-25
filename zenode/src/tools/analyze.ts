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
import { BaseToolRequestSchema } from '../utils/schema-helpers.js';
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
import { modelProviderRegistry } from '../providers/registry.js';

/**
 * Request validation schema
 */
const AnalyzeRequestSchema = BaseToolRequestSchema.extend({
  files: z.array(z.string()).optional(),
  prompt: z.string(),
  analysis_type: AnalysisTypeSchema.optional(),
  output_format: OutputFormatSchema.default('detailed'),
});

export class AnalyzeTool extends BaseTool {
  name = 'analyze';
  
  description = 
    'ANALYZE FILES & CODE - General-purpose analysis for understanding code. ' +
    'IMPORTANT: This tool MUST be used when explicitly invoked (e.g., "zenode:analyze [files/query]"). ' +
    'Supports both individual files and entire directories. ' +
    'Use this when you need to analyze files, examine code, or understand specific aspects of a codebase. ' +
    'Perfect for: codebase exploration, dependency analysis, pattern detection. ' +
    'Always uses file paths for clean terminal output. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getZodSchema() {
    return AnalyzeRequestSchema;
  }
  
  getSystemPrompt(): string {
    return ANALYZE_PROMPT;
  }
  
  async execute(args: AnalyzeRequest): Promise<ToolOutput> {
    try {
      // Validate request using the base method
      const validatedRequest = this.validateArgs<z.infer<typeof AnalyzeRequestSchema>>(args);
      logger.debug('Analyze request validated', { 
        files: validatedRequest.files?.length || 0,
        analysisType: validatedRequest.analysis_type || 'general',
        outputFormat: validatedRequest.output_format,
      });
      
      // Check prompt size
      const sizeCheck = checkPromptSize(validatedRequest.prompt, 'prompt');
      if (sizeCheck) {
        return sizeCheck;
      }

      // Check if auto-discovery would be triggered
      const usedAutoDiscovery = !validatedRequest.files || validatedRequest.files.length === 0;
      if (usedAutoDiscovery) {
        logger.info('Auto-discovery triggered - will provide friendly intro message');
      }
      
      // Prepare the prompt
      const fullPrompt = await this.preparePrompt(validatedRequest);
      
      // Select model (with automatic vision model selection if images present)
      const model = await this.selectModel(validatedRequest.model, undefined, !!validatedRequest.images?.length);
      
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
      
      logger.info('Executing analysis', { 
        model,
        analysisType: validatedRequest.analysis_type || 'general',
      });
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);
      
      const formattedResponse = this.formatResponse(response.content, validatedRequest, usedAutoDiscovery);
      
      // Handle conversation threading with file tracking
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validatedRequest.prompt,
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validatedRequest.continuation_id,
        validatedRequest.files, // Track files provided by user
        validatedRequest.files, // Same files were processed by tool
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
    // Use smart file resolution with directory traversal
    const { fileContents, discoveryInfo } = await this.resolveAndReadFiles(request.files);
    
    // Format file content
    const formattedFiles = Object.entries(fileContents)
      .map(([path, content]) => `=== FILE: ${path} ===\n${content}\n=== END FILE ===`)
      .join('\n\n');
    
    // Build analysis instructions
    const analysisFocus = this.buildAnalysisFocus(request);
    
    // Add file discovery info if useful
    const discoveryContext = discoveryInfo.usedDefaultPath 
      ? `\n📁 Auto-discovered files: ${discoveryInfo.summary}`
      : `📁 File discovery: ${discoveryInfo.summary}`;
    
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

${discoveryContext}

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
  
  private formatResponse(response: string, request: AnalyzeRequest, usedAutoDiscovery: boolean = false): string {
    let formattedResponse = response;
    
    // Add friendly intro message if auto-discovery was used
    if (usedAutoDiscovery) {
      formattedResponse = `I'm going to take a look around the ol' filesystem, let me know if everything looks right to you.

${response}`;
    }
    
    const nextSteps = 'Use this analysis to actively continue your task. ' +
      'Investigate deeper into any findings, implement solutions based on these insights, ' +
      'and carry out the necessary work. Only pause to ask the user if you need their ' +
      'explicit approval for major changes or if critical decisions require their input.';
    
    return formatResponseWithNextSteps(formattedResponse, nextSteps);
  }
}