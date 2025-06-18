/**
 * Google Gemini AI Provider
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  BaseModelProvider, 
  RangeTemperatureConstraint,
  DiscreteTemperatureConstraint,
} from './base.js';
import { 
  ProviderType, 
  ModelRequest, 
  ModelResponse,
  ModelCapabilities,
  Message,
} from '../types/providers.js';
import { ImageCapabilities } from '../types/images.js';
import { logger } from '../utils/logger.js';

/**
 * Gemini model provider implementation
 */
export class GeminiProvider extends BaseModelProvider {
  readonly type = ProviderType.GOOGLE;
  readonly friendlyName = 'Gemini';
  
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    super(apiKey);
    this.client = new GoogleGenerativeAI(apiKey);
    this.initializeModels();
  }

  /**
   * Initialize supported models and their capabilities
   */
  private initializeModels(): void {
    // Gemini 2.5 Flash
    this.modelCapabilities.set('gemini-2.5-flash-preview-05-20', {
      provider: this.type,
      modelName: 'gemini-2.5-flash-preview-05-20',
      friendlyName: 'Gemini 2.5 Flash',
      contextWindow: 1048576, // 1M tokens
      supportsExtendedThinking: true,
      supportsSystemPrompts: true,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsJsonMode: true,
      temperatureConstraint: new RangeTemperatureConstraint(0, 2, 0.7),
    });

    // Gemini 2.5 Pro
    this.modelCapabilities.set('gemini-2.5-pro-preview-06-05', {
      provider: this.type,
      modelName: 'gemini-2.5-pro-preview-06-05',
      friendlyName: 'Gemini 2.5 Pro',
      contextWindow: 1048576, // 1M tokens
      supportsExtendedThinking: true,
      supportsSystemPrompts: true,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsJsonMode: true,
      temperatureConstraint: new RangeTemperatureConstraint(0, 2, 0.7),
    });

    // Set up aliases
    this.modelAliases.set('flash', 'gemini-2.5-flash-preview-05-20');
    this.modelAliases.set('gemini-flash', 'gemini-2.5-flash-preview-05-20');
    this.modelAliases.set('pro', 'gemini-2.5-pro-preview-06-05');
    this.modelAliases.set('gemini-pro', 'gemini-2.5-pro-preview-06-05');
  }

  /**
   * Generate a response from Gemini
   */
  async generateResponse(request: ModelRequest): Promise<ModelResponse> {
    const modelName = this.resolveModelAlias(request.model) || request.model;
    const temperature = this.validateTemperature(modelName, request.temperature);

    this.logRequest(modelName, request.messages, temperature);

    try {
      // Get the generative model
      const model = this.client.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
          temperature,
          maxOutputTokens: request.maxTokens,
          stopSequences: request.stopSequences,
        },
      });

      // Format messages for Gemini API
      const formattedMessages = this.formatMessagesForGemini(request.messages, request.systemPrompt);
      
      // Generate content
      const result = await model.generateContent(formattedMessages);
      const response = await result.response;
      const content = response.text();

      // Calculate token usage (Gemini provides this in metadata)
      const usage = {
        inputTokens: response.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      };

      const modelResponse: ModelResponse = {
        content,
        usage,
        modelName,
        friendlyName: this.friendlyName,
        provider: this.type,
        metadata: {
          finishReason: response.candidates?.[0]?.finishReason,
        },
      };

      this.logResponse(modelName, modelResponse);
      return modelResponse;

    } catch (error) {
      this.handleApiError(error, modelName);
    }
  }

  /**
   * Format messages for Gemini API
   * Gemini expects a different format than OpenAI-style messages
   */
  private formatMessagesForGemini(messages: Message[], systemPrompt?: string): string {
    let prompt = '';
    
    // Add system prompt if provided
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }

    // Convert messages to Gemini format
    for (const message of messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `User: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }

    // Add final prompt for assistant to respond
    prompt += 'Assistant: ';

    return prompt;
  }

  /**
   * Get image capabilities for Gemini models
   */
  async getImageCapabilities(modelName: string): Promise<ImageCapabilities> {
    const resolvedName = this.resolveModelAlias(modelName) || modelName;
    
    // Gemini vision models and their limits
    const visionModels = new Set([
      'gemini-pro-vision',
      'gemini-2.5-pro-preview-06-05',
      'gemini-2.5-flash-preview-05-20',
      'pro',
      'flash',
    ]);

    if (visionModels.has(resolvedName)) {
      return {
        supportsImages: true,
        maxImageSizeMB: 16, // Gemini limit for vision models
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      };
    }

    // Non-vision models
    return {
      supportsImages: false,
      maxImageSizeMB: 0,
      supportedFormats: [],
    };
  }
}