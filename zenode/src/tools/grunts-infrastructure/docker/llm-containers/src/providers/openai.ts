/**
 * OpenAI Model Provider
 */

import OpenAI from 'openai';
import { 
  BaseModelProvider, 
  FixedTemperatureConstraint,
  DiscreteTemperatureConstraint,
} from './base.js';
import { 
  ProviderType, 
  ModelRequest, 
  ModelResponse,
  ModelCapabilities,
  Message,
} from '../types/providers.js';
import { logger } from '../utils/logger.js';

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider extends BaseModelProvider {
  readonly type = ProviderType.OPENAI;
  readonly friendlyName = 'OpenAI';
  
  private client: OpenAI;

  constructor(apiKey: string) {
    super(apiKey);
    this.client = new OpenAI({ apiKey });
    this.initializeModels();
  }

  /**
   * Initialize supported models and their capabilities
   */
  private initializeModels(): void {
    // O3 model - fixed temperature
    this.modelCapabilities.set('o3', {
      provider: this.type,
      modelName: 'o3',
      friendlyName: 'OpenAI O3',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new FixedTemperatureConstraint(1.0),
    });

    // O3 Mini
    this.modelCapabilities.set('o3-mini', {
      provider: this.type,
      modelName: 'o3-mini',
      friendlyName: 'OpenAI O3 Mini',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new DiscreteTemperatureConstraint([0, 1, 2], 1),
    });

    // O3 Mini High
    this.modelCapabilities.set('o3-mini-high', {
      provider: this.type,
      modelName: 'o3-mini-high',
      friendlyName: 'OpenAI O3 Mini High',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new DiscreteTemperatureConstraint([0, 1, 2], 1),
    });

    // O3 Pro
    this.modelCapabilities.set('o3-pro', {
      provider: this.type,
      modelName: 'o3-pro',
      friendlyName: 'OpenAI O3 Pro',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new FixedTemperatureConstraint(1.0),
    });

    // O4 Mini
    this.modelCapabilities.set('o4-mini', {
      provider: this.type,
      modelName: 'o4-mini',
      friendlyName: 'OpenAI O4 Mini',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new DiscreteTemperatureConstraint([0, 1, 2], 1),
    });

    // O4 Mini High
    this.modelCapabilities.set('o4-mini-high', {
      provider: this.type,
      modelName: 'o4-mini-high',
      friendlyName: 'OpenAI O4 Mini High',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new DiscreteTemperatureConstraint([0, 1, 2], 1),
    });

    // Set up aliases
    this.modelAliases.set('o3mini', 'o3-mini');
    this.modelAliases.set('o3-mini-hi', 'o3-mini-high');
    this.modelAliases.set('o3minihigh', 'o3-mini-high');
    this.modelAliases.set('o3pro', 'o3-pro');
    this.modelAliases.set('o4mini', 'o4-mini');
    this.modelAliases.set('o4minihigh', 'o4-mini-high');
    this.modelAliases.set('o4-mini-hi', 'o4-mini-high');
  }

  /**
   * Generate a response from OpenAI
   */
  async generateResponse(request: ModelRequest): Promise<ModelResponse> {
    const modelName = this.resolveModelAlias(request.model) || request.model;
    const temperature = this.validateTemperature(modelName, request.temperature);

    this.logRequest(modelName, request.messages, temperature);

    try {
      // Format messages with system prompt
      const messages = this.formatMessages(request.messages, request.systemPrompt);

      // Create chat completion
      const completion = await this.client.chat.completions.create({
        model: modelName,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        temperature,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
        response_format: request.jsonMode ? { type: 'json_object' } : undefined,
        stream: false, // We don't support streaming yet
      });

      const choice = completion.choices[0];
      if (!choice?.message?.content) {
        throw new Error('No content in OpenAI response');
      }

      const usage = {
        inputTokens: completion.usage?.prompt_tokens || 0,
        outputTokens: completion.usage?.completion_tokens || 0,
        totalTokens: completion.usage?.total_tokens || 0,
      };

      const modelResponse: ModelResponse = {
        content: choice.message.content,
        usage,
        modelName,
        friendlyName: this.friendlyName,
        provider: this.type,
        metadata: {
          finishReason: choice.finish_reason,
          model: completion.model,
        },
      };

      this.logResponse(modelName, modelResponse);
      return modelResponse;

    } catch (error) {
      this.handleApiError(error, modelName);
    }
  }
}