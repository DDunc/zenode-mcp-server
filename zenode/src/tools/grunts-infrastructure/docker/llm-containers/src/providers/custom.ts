/**
 * Custom Model Provider
 * 
 * Supports local models through OpenAI-compatible APIs (Ollama, vLLM, LM Studio, etc.)
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
} from '../types/providers.js';
import { logger } from '../utils/logger.js';
import { CUSTOM_MODEL_NAME } from '../config.js';

/**
 * Custom provider implementation for local/self-hosted models
 */
export class CustomProvider extends BaseModelProvider {
  readonly type = ProviderType.CUSTOM;
  readonly friendlyName = 'Custom';
  
  private client: AxiosInstance;
  private baseUrl: string;
  private defaultModel: string;

  constructor(apiKey: string, baseUrl: string) {
    super(apiKey);
    this.baseUrl = baseUrl;
    this.defaultModel = CUSTOM_MODEL_NAME;
    
    // Create axios client with appropriate headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Only add authorization if API key is provided
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    this.client = axios.create({
      baseURL: baseUrl,
      headers,
      timeout: 120000, // 2 minutes timeout for local models
    });

    this.initializeModels();
    logger.info(`Custom provider initialized for ${baseUrl}`);
  }

  /**
   * Initialize supported models
   * For custom providers, we create a generic model entry
   */
  private initializeModels(): void {
    // Add the default model
    this.addModel(this.defaultModel);
    
    // Common local model aliases
    const commonModels = [
      'llama3.2',
      'llama3.1',
      'llama3',
      'llama2',
      'mistral',
      'mixtral',
      'qwen',
      'deepseek',
      'phi',
      'gpt-3.5-turbo',
      'gpt-4',
    ];
    
    for (const model of commonModels) {
      this.addModel(model);
    }
  }

  /**
   * Add a model with default capabilities
   */
  private addModel(modelName: string): void {
    this.modelCapabilities.set(modelName, {
      provider: this.type,
      modelName,
      friendlyName: `${modelName} (Local)`,
      contextWindow: 32768, // Conservative default
      supportsExtendedThinking: false,
      supportsSystemPrompts: true,
      supportsStreaming: false,
      supportsFunctionCalling: false,
      supportsJsonMode: false,
      temperatureConstraint: new RangeTemperatureConstraint(0, 2, 0.7),
    });
  }

  /**
   * Override to always return true for custom models
   * This allows using any model name with custom endpoints
   */
  validateModel(modelName: string): boolean {
    // Always return true for custom endpoints
    // The actual validation happens when making the API call
    return true;
  }

  /**
   * Override to add model if not exists
   */
  getModelCapabilities(modelName: string): ModelCapabilities | null {
    let capabilities = super.getModelCapabilities(modelName);
    
    // If model not found, add it dynamically
    if (!capabilities) {
      this.addModel(modelName);
      capabilities = super.getModelCapabilities(modelName);
    }
    
    return capabilities;
  }

  /**
   * Generate a response from the custom endpoint
   */
  async generateResponse(request: ModelRequest): Promise<ModelResponse> {
    const modelName = request.model || this.defaultModel;
    const temperature = this.validateTemperature(modelName, request.temperature);

    this.logRequest(modelName, request.messages, temperature);

    try {
      // Format messages with system prompt
      const messages = this.formatMessages(request.messages, request.systemPrompt);

      // Create OpenAI-compatible request
      const requestData = {
        model: modelName,
        messages,
        temperature,
        max_tokens: request.maxTokens,
        stop: request.stopSequences,
        stream: false,
      };

      // Different endpoints might use different paths
      const paths = ['/v1/chat/completions', '/chat/completions', '/api/chat'];
      let response;
      let lastError;

      for (const path of paths) {
        try {
          response = await this.client.post(path, requestData);
          break; // Success, exit loop
        } catch (error) {
          lastError = error;
          logger.debug(`Custom provider: ${path} failed, trying next...`);
        }
      }

      if (!response) {
        throw lastError || new Error('All API paths failed');
      }

      const data = response.data;
      
      // Handle different response formats
      let content: string;
      let usage;

      // OpenAI-compatible format
      if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
        usage = {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        };
      } 
      // Ollama format
      else if (data.response) {
        content = data.response;
        usage = {
          inputTokens: this.estimateTokens(messages.map(m => m.content).join(' ')),
          outputTokens: this.estimateTokens(content),
          totalTokens: 0,
        };
        usage.totalTokens = usage.inputTokens + usage.outputTokens;
      }
      // Generic format
      else if (typeof data === 'string') {
        content = data;
        usage = {
          inputTokens: this.estimateTokens(messages.map(m => m.content).join(' ')),
          outputTokens: this.estimateTokens(content),
          totalTokens: 0,
        };
        usage.totalTokens = usage.inputTokens + usage.outputTokens;
      } else {
        throw new Error('Unexpected response format from custom endpoint');
      }

      const modelResponse: ModelResponse = {
        content,
        usage,
        modelName,
        friendlyName: `${this.friendlyName} (${modelName})`,
        provider: this.type,
        metadata: {
          endpoint: this.baseUrl,
          model: data.model || modelName,
        },
      };

      this.logResponse(modelName, modelResponse);
      return modelResponse;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        
        if (status === 401) {
          throw new Error(`Custom API authentication failed at ${this.baseUrl}. Check if API key is required.`);
        }
        if (status === 404) {
          throw new Error(`API endpoint not found at ${this.baseUrl}. Check the URL.`);
        }
        if (error.code === 'ECONNREFUSED') {
          throw new Error(`Cannot connect to ${this.baseUrl}. Is the service running?`);
        }
        
        throw new Error(`Custom API error: ${error.message}`);
      }
      
      this.handleApiError(error, modelName);
    }
  }
}