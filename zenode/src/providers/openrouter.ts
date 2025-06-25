/**
 * OpenRouter Model Provider
 * 
 * Provides access to multiple AI models through the OpenRouter unified API
 */

import axios, { AxiosInstance } from 'axios';
import { 
  BaseModelProvider, 
  RangeTemperatureConstraint,
} from './base.js';
import { 
  ProviderType, 
  ModelRequest, 
  ModelResponse,
  ModelCapabilities,
  Message,
  CustomModelsConfig,
} from '../types/providers.js';
import { ImageCapabilities } from '../types/images.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * OpenRouter provider implementation
 */
export class OpenRouterProvider extends BaseModelProvider {
  readonly type = ProviderType.OPENROUTER;
  readonly friendlyName = 'OpenRouter';
  
  private client: AxiosInstance;
  private customModelsConfig: CustomModelsConfig | null = null;

  private initializationPromise: Promise<void> | null = null;

  constructor(apiKey: string) {
    super(apiKey);
    
    this.client = axios.create({
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        //FIXME: define from the user!
        'HTTP-Referer': 'https://github.com/DDunc/zenode-mcp-server',
        'X-Title': 'Zenode MCP Server',
        'Content-Type': 'application/json',
      },
    });

    // Start initialization but track the promise
    this.initializationPromise = this.initializeModels().catch(error => {
      logger.error('Failed to initialize OpenRouter models:', error);
      throw error;
    });
  }

  /**
   * Ensure provider is fully initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      this.initializationPromise = null;
    }
  }

  /**
   * Initialize supported models and their capabilities
   */
  private async initializeModels(): Promise<void> {
    // Load custom models configuration
    await this.loadCustomModelsConfig();

    // Add models from custom config
    if (this.customModelsConfig) {
      for (const model of this.customModelsConfig.models) {
        // Skip custom-only models
        if (model.is_custom) continue;

        const capabilities: ModelCapabilities = {
          provider: this.type,
          modelName: model.model_name,
          friendlyName: model.description,
          contextWindow: model.context_window,
          supportsExtendedThinking: model.supports_extended_thinking,
          supportsSystemPrompts: true,
          supportsStreaming: false,
          supportsFunctionCalling: model.supports_function_calling,
          supportsJsonMode: model.supports_json_mode,
          temperatureConstraint: new RangeTemperatureConstraint(0, 2, 0.7),
        };

        this.modelCapabilities.set(model.model_name, capabilities);

        // Add aliases
        for (const alias of model.aliases) {
          this.modelAliases.set(alias, model.model_name);
        }
      }
    }

    // Add some default models if config loading failed
    if (this.modelCapabilities.size === 0) {
      this.addDefaultModels();
    }
  }

  /**
   * Load custom models configuration
   */
  private async loadCustomModelsConfig(): Promise<void> {
    try {
      const configPath = path.resolve(__dirname, '../../conf/custom_models.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.customModelsConfig = JSON.parse(configData) as CustomModelsConfig;
      logger.debug('OpenRouter loaded custom models configuration');
    } catch (error) {
      logger.warn('OpenRouter could not load custom_models.json:', error);
    }
  }

  /**
   * Add default models if config loading fails
   */
  private addDefaultModels(): void {
    // Claude Sonnet models (preferred default)
    this.modelCapabilities.set('anthropic/claude-3-sonnet', {
      provider: this.type,
      modelName: 'anthropic/claude-3-sonnet',
      friendlyName: 'Claude 3 Sonnet (via OpenRouter)',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: false,
      supportsFunctionCalling: true,
      supportsJsonMode: false,
      temperatureConstraint: new RangeTemperatureConstraint(0, 1, 0.7),
    });

    this.modelCapabilities.set('anthropic/claude-3.5-sonnet', {
      provider: this.type,
      modelName: 'anthropic/claude-3.5-sonnet',
      friendlyName: 'Claude 3.5 Sonnet (via OpenRouter)',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: false,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new RangeTemperatureConstraint(0, 1, 0.7),
    });

    this.modelCapabilities.set('anthropic/claude-3.7-sonnet', {
      provider: this.type,
      modelName: 'anthropic/claude-3.7-sonnet',
      friendlyName: 'Claude 3.7 Sonnet (via OpenRouter)',
      contextWindow: 200000,
      supportsExtendedThinking: true,
      supportsSystemPrompts: true,
      supportsStreaming: false,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new RangeTemperatureConstraint(0, 1, 0.7),
    });

    // Claude Haiku (fast model)
    this.modelCapabilities.set('anthropic/claude-3-haiku', {
      provider: this.type,
      modelName: 'anthropic/claude-3-haiku',
      friendlyName: 'Claude 3 Haiku (via OpenRouter)',
      contextWindow: 200000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: false,
      supportsFunctionCalling: true,
      supportsJsonMode: false,
      temperatureConstraint: new RangeTemperatureConstraint(0, 1, 0.7),
    });

    // Add aliases for easier access
    this.modelAliases.set('sonnet', 'anthropic/claude-3.5-sonnet');
    this.modelAliases.set('sonnet35', 'anthropic/claude-3.5-sonnet');
    this.modelAliases.set('sonnet37', 'anthropic/claude-3.7-sonnet');
    this.modelAliases.set('haiku', 'anthropic/claude-3-haiku');
    
    // Add Opus only if explicitly enabled via config
    const enableOpus = process.env.ENABLE_CLAUDE_OPUS === 'true';
    if (enableOpus) {
      this.modelCapabilities.set('anthropic/claude-3-opus', {
        provider: this.type,
        modelName: 'anthropic/claude-3-opus',
        friendlyName: 'Claude 3 Opus (via OpenRouter)',
        contextWindow: 200000,
        supportsExtendedThinking: false,
        supportsSystemPrompts: true,
        supportsStreaming: false,
        supportsFunctionCalling: true,
        supportsJsonMode: false,
        temperatureConstraint: new RangeTemperatureConstraint(0, 1, 0.7),
      });
      this.modelAliases.set('opus', 'anthropic/claude-3-opus');
    }

    // Add Gemini models via OpenRouter
    this.modelCapabilities.set('google/gemini-2.5-flash-preview-05-20', {
      provider: this.type,
      modelName: 'google/gemini-2.5-flash-preview-05-20',
      friendlyName: 'Gemini 2.5 Flash (via OpenRouter)',
      contextWindow: 1000000,
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: false,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new RangeTemperatureConstraint(0, 2, 0.7),
    });

    this.modelCapabilities.set('google/gemini-2.5-pro-preview-06-05', {
      provider: this.type,
      modelName: 'google/gemini-2.5-pro-preview-06-05',
      friendlyName: 'Gemini 2.5 Pro (via OpenRouter)',
      contextWindow: 1000000,
      supportsExtendedThinking: true,
      supportsSystemPrompts: true,
      supportsStreaming: false,
      supportsFunctionCalling: true,
      supportsJsonMode: true,
      temperatureConstraint: new RangeTemperatureConstraint(0, 2, 0.7),
    });

    // Add Gemini aliases
    this.modelAliases.set('flash', 'google/gemini-2.5-flash-preview-05-20');
    this.modelAliases.set('pro', 'google/gemini-2.5-pro-preview-06-05');
  }

  /**
   * Generate a response from OpenRouter
   */
  async generateResponse(request: ModelRequest): Promise<ModelResponse> {
    // Ensure provider is fully initialized before processing
    await this.ensureInitialized();
    
    const modelName = this.resolveModelAlias(request.model) || request.model;
    const temperature = this.validateTemperature(modelName, request.temperature);

    this.logRequest(modelName, request.messages, temperature);

    try {
      // Format messages with system prompt
      const messages = this.formatMessages(request.messages, request.systemPrompt);

      // Create chat completion request
      const requestData = {
        model: modelName,
        messages,
        temperature,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
        stream: false,
      };

      const response = await this.client.post('/chat/completions', requestData);
      const data = response.data;

      const choice = data.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error('No content in OpenRouter response');
      }

      const usage = {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      };

      const modelResponse: ModelResponse = {
        content: choice.message.content,
        usage,
        modelName,
        friendlyName: `${this.friendlyName} (${modelName})`,
        provider: this.type,
        metadata: {
          finishReason: choice.finish_reason,
          model: data.model,
          provider: data.provider, // OpenRouter includes the actual provider used
        },
      };

      this.logResponse(modelName, modelResponse);
      return modelResponse;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        if (status === 401) {
          throw new Error('OpenRouter API authentication failed. Please check your API key.');
        }
        if (status === 429) {
          throw new Error('OpenRouter API rate limit exceeded. Please try again later.');
        }
        if (status === 404) {
          throw new Error(`Model ${modelName} not found on OpenRouter.`);
        }
        
        throw new Error(`OpenRouter API error: ${errorData?.error?.message || error.message}`);
      }
      
      this.handleApiError(error, modelName);
    }
  }

  /**
   * Get list of available models (ensure initialization)
   */
  getAvailableModels(): string[] {
    // Note: This is a synchronous method but initialization is async
    // Return what we have, even if initialization isn't complete
    return super.getAvailableModels();
  }

  /**
   * Get image capabilities for OpenRouter models
   */
  async getImageCapabilities(modelName: string): Promise<ImageCapabilities> {
    // Ensure provider is fully initialized before processing
    await this.ensureInitialized();
    
    const resolvedName = this.resolveModelAlias(modelName) || modelName;
    
    // OpenRouter vision models and their limits
    const visionModels = new Map<string, ImageCapabilities>([
      // OpenAI models via OpenRouter
      ['openai/gpt-4o', {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['openai/gpt-4o-mini', {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['openai/o3', {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['openai/o3-mini', {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['openai/o3-mini-high', {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['openai/o3-pro', {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['openai/o4-mini', {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['openai/o4-mini-high', {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      
      // Claude models via OpenRouter (Claude 3+ supports images)
      ['anthropic/claude-3-opus', {
        supportsImages: true,
        maxImageSizeMB: 5,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['anthropic/claude-3-sonnet', {
        supportsImages: true,
        maxImageSizeMB: 5,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['anthropic/claude-3-haiku', {
        supportsImages: true,
        maxImageSizeMB: 5,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['anthropic/claude-3-5-sonnet-20241022', {
        supportsImages: true,
        maxImageSizeMB: 5,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['anthropic/claude-3.5-sonnet', {
        supportsImages: true,
        maxImageSizeMB: 5,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['anthropic/claude-3.7-sonnet', {
        supportsImages: true,
        maxImageSizeMB: 5,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      
      // Gemini models via OpenRouter
      ['google/gemini-2.5-pro-preview', {
        supportsImages: true,
        maxImageSizeMB: 16,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['google/gemini-2.5-flash-preview-05-20', {
        supportsImages: true,
        maxImageSizeMB: 16,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['google/gemini-2.5-pro-preview-06-05', {
        supportsImages: true,
        maxImageSizeMB: 16,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      
      // Llama models via OpenRouter (Llama 3.2 11B Vision, Llama 4 models)
      ['meta-llama/llama-3.2-11b-vision-instruct', {
        supportsImages: true,
        maxImageSizeMB: 10,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['meta-llama/llama-4-maverick-17b-instruct', {
        supportsImages: true,
        maxImageSizeMB: 15,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      ['meta-llama/llama-4-scout', {
        supportsImages: true,
        maxImageSizeMB: 15,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
      
      // Mistral models with vision (Mistral Small 3.1)
      ['mistralai/mistral-small-3.1', {
        supportsImages: true,
        maxImageSizeMB: 8,
        supportedFormats: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      }],
    ]);

    // Check exact model match
    const capabilities = visionModels.get(resolvedName);
    if (capabilities) {
      return capabilities;
    }

    // Check for partial matches (for models that might have version suffixes)
    for (const [modelKey, caps] of visionModels.entries()) {
      if (resolvedName.includes(modelKey) || modelKey.includes(resolvedName)) {
        return caps;
      }
    }

    // Non-vision models
    return {
      supportsImages: false,
      maxImageSizeMB: 0,
      supportedFormats: [],
    };
  }
}