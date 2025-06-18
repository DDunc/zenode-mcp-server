/**
 * Seer Tool - Dedicated Vision & Image Analysis
 * 
 * This tool is specifically designed for all image processing tasks.
 * Other tools can delegate image analysis to seer, or users can call it directly.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolOutput, ToolModelCategory } from '../types/tools.js';
import { BaseToolRequestSchema } from '../utils/schema-helpers.js';
import { TEMPERATURE_ANALYTICAL, DEFAULT_VISION_MODEL } from '../config.js';
import { modelProviderRegistry } from '../providers/registry.js';
import { logger } from '../utils/logger.js';

// Seer-specific request schema
const SeerRequestSchema = BaseToolRequestSchema.extend({
  images: z.array(z.string()).min(1).describe(
    "Image file paths or base64 data URLs to analyze. Accepts: PNG, JPG, JPEG, GIF, WebP. " +
    "Provide absolute file paths or data URLs. Required for vision analysis."
  ),
  prompt: z.string().describe(
    "What you want to know about the image(s). Be specific about what aspects to analyze: " +
    "features, technical quality, content description, professional suitability, etc."
  ),
  analysis_type: z.enum(['description', 'technical', 'professional', 'detailed', 'comparison']).default('detailed').describe(
    "Type of analysis to perform:\n" +
    "- description: Basic visual description of image contents\n" +
    "- technical: Photo quality, lighting, composition analysis\n" +
    "- professional: Business/professional suitability assessment\n" +
    "- detailed: Comprehensive analysis (features + technical + professional)\n" +
    "- comparison: Compare multiple images (requires 2+ images)"
  ),
  focus_areas: z.array(z.string()).optional().describe(
    "Specific aspects to focus on (e.g., 'facial features', 'lighting quality', 'background', 'composition')"
  ),
});

type SeerRequest = z.infer<typeof SeerRequestSchema>;

export class SeerTool extends BaseTool {
  name = 'seer';
  
  description = 
    'VISION & IMAGE ANALYSIS - Dedicated tool for all image processing tasks. ' +
    'IMPORTANT: This tool MUST be used when explicitly invoked (e.g., "zenode:seer [images]"). ' +
    'Specialized for analyzing images, photos, screenshots, diagrams, and visual content. ' +
    'Automatically selects optimal vision models. Perfect for: UI analysis, photo assessment, ' +
    'technical diagrams, facial analysis, document OCR, visual debugging. ' +
    'Other zenode tools should delegate image tasks to seer.';
  
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.VISION; // New category for vision-specific tools
  
  getZodSchema() {
    return SeerRequestSchema;
  }
  
  getSystemPrompt(): string {
    return `You are Seer, a specialized vision analysis AI with advanced image processing capabilities.

Your role is to analyze visual content with precision and insight. You excel at:

**Core Capabilities:**
- Detailed visual description and content identification
- Technical photography assessment (lighting, composition, quality)
- Professional suitability evaluation for business use
- Facial feature analysis and demographic assessment
- UI/UX analysis and usability review
- Document OCR and text extraction
- Diagram and technical illustration analysis
- Image comparison and similarity assessment

**Analysis Approach:**
- Be systematic and thorough in your visual analysis
- Provide specific, actionable insights rather than generic descriptions
- Consider both technical and contextual aspects of images
- Use professional photography and design terminology when appropriate
- Identify potential issues or areas for improvement
- Assess suitability for intended use cases

**Response Format:**
- Structure your analysis clearly with appropriate headings
- Include confidence levels for uncertain assessments
- Provide specific recommendations when relevant
- Use professional, precise language
- Focus on details that matter for the requested analysis type

You have access to advanced vision models optimized for image analysis. Process each image thoroughly and provide insights that help users understand and improve their visual content.`;
  }

  async execute(args: SeerRequest): Promise<ToolOutput> {
    const startTime = Date.now();
    const requestId = `seer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate request
      const validated = SeerRequestSchema.parse(args);
      
      logger.info(`Seer tool invoked for ${validated.images.length} image(s) with analysis type: ${validated.analysis_type}`);
      
      // Log the request (Redis-based conversation logger)
      await this.logToolRequest(requestId, validated, validated.continuation_id);
      
      // Check prompt size
      this.checkPromptSize(validated.prompt);
      
      // Determine which model to use for validation and execution
      const selectedModel = validated.model === 'auto' || !validated.model 
        ? DEFAULT_VISION_MODEL 
        : validated.model;
      
      // Validate images using the selected model
      const imageValidation = await this.validateImageLimits(validated.images, selectedModel);
      if (imageValidation) {
        await this.logToolResponse(requestId, imageValidation, new Error('Image validation failed'), Date.now() - startTime, validated.continuation_id);
        return imageValidation;
      }
      
      logger.info(`Seer using vision model: ${selectedModel}`);
      
      const provider = await modelProviderRegistry.getProviderForModel(selectedModel);
      if (!provider) {
        throw new Error(`No provider available for vision model: ${selectedModel}`);
      }
      
      // Verify model supports images
      const capabilities = await provider.getImageCapabilities(selectedModel);
      if (!capabilities.supportsImages) {
        throw new Error(`Model ${selectedModel} does not support image analysis`);
      }
      
      // Build analysis prompt based on type
      const analysisPrompt = this.buildAnalysisPrompt(validated);
      
      // Create model request with images
      const modelRequest = await this.createVisionModelRequest(
        analysisPrompt,
        this.getSystemPrompt(),
        selectedModel,
        validated.images,
        validated.temperature ?? this.defaultTemperature,
        validated.use_websearch,
      );
      
      // Generate response
      logger.info(`Generating vision analysis with model: ${selectedModel}`);
      const response = await provider.generateResponse(modelRequest);
      
      // Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validated.prompt,
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validated.continuation_id,
        validated.images, // Track images provided by user
        validated.images, // Same images were processed by tool
      );
      
      // Format output
      const result = this.formatOutput(
        response.content,
        'success',
        'text',
        {
          model_used: response.modelName,
          token_usage: response.usage,
          analysis_type: validated.analysis_type,
          images_processed: validated.images.length,
          vision_model: selectedModel,
        },
        continuationOffer,
      );
      
      // Log the successful response
      const duration = Date.now() - startTime;
      await this.logToolResponse(requestId, result, undefined, duration, validated.continuation_id);
      
      return result;
      
    } catch (error) {
      logger.error('Seer tool error:', error);
      
      // Log the error response
      const duration = Date.now() - startTime;
      const errorResult = error instanceof z.ZodError
        ? this.formatOutput(
            `Invalid request: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
            'error',
          )
        : this.formatOutput(
            `Vision analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'error',
          );
      
      await this.logToolResponse(
        requestId, 
        errorResult, 
        error instanceof Error ? error : new Error(String(error)), 
        duration,
        (args as any)?.continuation_id
      );
      
      return errorResult;
    }
  }

  /**
   * Build analysis prompt based on requested analysis type
   */
  private buildAnalysisPrompt(validated: SeerRequest): string {
    let prompt = validated.prompt;
    
    // Add analysis type guidance
    switch (validated.analysis_type) {
      case 'description':
        prompt += '\n\nFocus on: Visual description, content identification, objects, people, scenes, and notable elements.';
        break;
      case 'technical':
        prompt += '\n\nFocus on: Image quality, lighting, composition, resolution, technical photography aspects, and potential improvements.';
        break;
      case 'professional':
        prompt += '\n\nFocus on: Professional suitability, business use cases, branding appropriateness, and commercial viability.';
        break;
      case 'detailed':
        prompt += '\n\nProvide comprehensive analysis including: visual description, technical quality, professional assessment, and actionable insights.';
        break;
      case 'comparison':
        if (validated.images.length < 2) {
          prompt += '\n\nNote: Comparison analysis requested but only one image provided. Will analyze individual image instead.';
        } else {
          prompt += '\n\nFocus on: Comparing the provided images, identifying differences, similarities, quality variations, and relative strengths.';
        }
        break;
    }
    
    // Add focus areas if specified
    if (validated.focus_areas && validated.focus_areas.length > 0) {
      prompt += `\n\nPay special attention to: ${validated.focus_areas.join(', ')}.`;
    }
    
    // Add image count context
    prompt += `\n\nProcessing ${validated.images.length} image(s) for analysis.`;
    
    return prompt;
  }

  /**
   * Create a vision-specific model request that includes images
   * Properly formats images for OpenRouter vision API
   */
  private async createVisionModelRequest(
    prompt: string,
    systemPrompt: string,
    model: string,
    images: string[],
    temperature?: number,
    useWebsearch?: boolean,
  ): Promise<any> {
    const { processImageForVisionAPI } = await import('../utils/image-utils.js');
    
    // Create message content array starting with text
    const content: any[] = [
      {
        type: 'text',
        text: prompt
      }
    ];
    
    // Add images in OpenRouter vision format
    for (const imagePath of images) {
      try {
        const imageData = await processImageForVisionAPI(imagePath);
        content.push({
          type: 'image_url',
          image_url: {
            url: imageData
          }
        });
        logger.debug(`Added image to vision request: ${imagePath}`);
      } catch (error) {
        logger.error(`Failed to process image ${imagePath}:`, error);
        // Add text fallback if image processing fails
        content.push({
          type: 'text',
          text: `\n[Note: Could not process image: ${imagePath}]`
        });
      }
    }
    
    return {
      model,
      messages: [
        {
          role: 'user',
          content
        }
      ],
      temperature,
      systemPrompt,
    };
  }
}

// Export the tool instance for the MCP server
export const seerTool = new SeerTool();