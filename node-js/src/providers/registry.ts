/**
 * Model Provider Registry
 *
 * Manages registration and retrieval of AI model providers.
 * Handles provider discovery, model routing, and fallback logic.
 */

import { 
  ModelProvider, 
  ProviderType, 
  ProviderFactory,
  CustomModelsConfig,
  ModelCapabilities,
} from '../types/providers.js';
import { 
  GEMINI_API_KEY, 
  OPENAI_API_KEY, 
  OPENROUTER_API_KEY,
  CUSTOM_API_URL,
  CUSTOM_API_KEY,
  IS_AUTO_MODE,
  OPENAI_ALLOWED_MODELS,
  GOOGLE_ALLOWED_MODELS,
} from '../config.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Model Provider Registry singleton
 */
export class ModelProviderRegistry {
  private static instance: ModelProviderRegistry;
  private providers = new Map<ProviderType, ModelProvider>();
  private providerFactories = new Map<ProviderType, ProviderFactory>();
  private customModelsConfig: CustomModelsConfig | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get registry instance
   */
  static getInstance(): ModelProviderRegistry {
    if (!ModelProviderRegistry.instance) {
      ModelProviderRegistry.instance = new ModelProviderRegistry();
    }
    return ModelProviderRegistry.instance;
  }

  /**
   * Initialize the registry with configured providers
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing Model Provider Registry...');

    // Load custom models configuration
    await this.loadCustomModelsConfig();

    // Register provider factories based on configuration
    await this.registerConfiguredProviders();

    // Validate auto mode if enabled
    if (IS_AUTO_MODE) {
      this.validateAutoMode();
    }

    this.initialized = true;
    logger.info('Model Provider Registry initialized successfully');
  }

  /**
   * Load custom models configuration
   */
  private async loadCustomModelsConfig(): Promise<void> {
    try {
      // Try to load from the parent conf directory
      const configPath = path.resolve(__dirname, '../../../conf/custom_models.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      this.customModelsConfig = JSON.parse(configData) as CustomModelsConfig;
      logger.info('Loaded custom models configuration');
    } catch (error) {
      logger.warn('Could not load custom_models.json, using defaults:', error);
      // Use a minimal default configuration
      this.customModelsConfig = {
        models: [],
      };
    }
  }

  /**
   * Register providers based on environment configuration
   */
  private async registerConfiguredProviders(): Promise<void> {
    const hasNativeApis = 
      (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') ||
      (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here');

    // Register native providers first (highest priority)
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      await this.registerProviderFactory(ProviderType.GOOGLE, async (apiKey?: string) => {
        const { GeminiProvider } = await import('./gemini.js');
        return new GeminiProvider(apiKey || GEMINI_API_KEY || '');
      });
      logger.info('Registered Gemini provider');
    }

    if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
      await this.registerProviderFactory(ProviderType.OPENAI, async (apiKey?: string) => {
        const { OpenAIProvider } = await import('./openai.js');
        return new OpenAIProvider(apiKey || OPENAI_API_KEY || '');
      });
      logger.info('Registered OpenAI provider');
    }

    // Register custom provider (medium priority)
    if (CUSTOM_API_URL) {
      await this.registerProviderFactory(ProviderType.CUSTOM, async (apiKey?: string) => {
        const { CustomProvider } = await import('./custom.js');
        return new CustomProvider(apiKey || CUSTOM_API_KEY || '', CUSTOM_API_URL || '');
      });
      logger.info(`Registered Custom provider for ${CUSTOM_API_URL}`);
    }

    // Register OpenRouter as catch-all (lowest priority)
    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') {
      await this.registerProviderFactory(ProviderType.OPENROUTER, async (apiKey?: string) => {
        const { OpenRouterProvider } = await import('./openrouter.js');
        return new OpenRouterProvider(apiKey || OPENROUTER_API_KEY || '');
      });
      logger.info('Registered OpenRouter provider');
    }

    // Log provider priority
    const priority: string[] = [];
    if (hasNativeApis) priority.push('Native APIs (Gemini, OpenAI)');
    if (CUSTOM_API_URL) priority.push('Custom endpoints');
    if (OPENROUTER_API_KEY) priority.push('OpenRouter (catch-all)');

    if (priority.length > 1) {
      logger.info(`Provider priority: ${priority.join(' → ')}`);
    }
  }

  /**
   * Register a provider factory
   */
  private async registerProviderFactory(
    type: ProviderType, 
    factory: ProviderFactory,
  ): Promise<void> {
    this.providerFactories.set(type, factory);
  }

  /**
   * Get a provider instance
   */
  async getProvider(type: ProviderType): Promise<ModelProvider | null> {
    // Check if already instantiated
    let provider = this.providers.get(type);
    if (provider) {
      return provider;
    }

    // Try to create from factory
    const factory = this.providerFactories.get(type);
    if (factory) {
      try {
        provider = await factory();
        this.providers.set(type, provider);
        return provider;
      } catch (error) {
        logger.error(`Failed to create provider ${type}:`, error);
      }
    }

    return null;
  }

  /**
   * Get provider for a specific model
   */
  async getProviderForModel(modelName: string): Promise<ModelProvider | null> {
    // Check model restrictions first
    if (!this.isModelAllowed(modelName)) {
      logger.warn(`Model ${modelName} is not allowed by restrictions`);
      return null;
    }

    // Try each provider in priority order
    for (const type of [ProviderType.GOOGLE, ProviderType.OPENAI, ProviderType.CUSTOM, ProviderType.OPENROUTER]) {
      const provider = await this.getProvider(type);
      if (provider && provider.validateModel(modelName)) {
        return provider;
      }
    }

    // Try to resolve through custom models config
    const customModel = this.customModelsConfig?.models.find(
      (m) => m.model_name === modelName || m.aliases.includes(modelName),
    );

    if (customModel) {
      // If it's a custom-only model, use custom provider
      if (customModel.is_custom) {
        return await this.getProvider(ProviderType.CUSTOM);
      }
      // Otherwise, try OpenRouter
      return await this.getProvider(ProviderType.OPENROUTER);
    }

    logger.warn(`No provider found for model: ${modelName}`);
    return null;
  }

  /**
   * Get all available models across all providers
   */
  async getAvailableModels(respectRestrictions = true): Promise<string[]> {
    const allModels = new Set<string>();

    // Collect models from all providers
    for (const type of this.providerFactories.keys()) {
      const provider = await this.getProvider(type);
      if (provider) {
        const models = provider.getAvailableModels();
        models.forEach((model) => {
          if (!respectRestrictions || this.isModelAllowed(model)) {
            allModels.add(model);
          }
        });
      }
    }

    // Add models from custom config
    if (this.customModelsConfig) {
      this.customModelsConfig.models.forEach((model) => {
        if (!respectRestrictions || this.isModelAllowed(model.model_name)) {
          allModels.add(model.model_name);
          model.aliases.forEach((alias) => allModels.add(alias));
        }
      });
    }

    return Array.from(allModels).sort();
  }

  /**
   * Check if a model is allowed by restrictions
   */
  private isModelAllowed(modelName: string): boolean {
    // Check Google model restrictions
    if (GOOGLE_ALLOWED_MODELS && GOOGLE_ALLOWED_MODELS.length > 0) {
      if (modelName.includes('gemini') || modelName.includes('flash') || modelName.includes('pro')) {
        return GOOGLE_ALLOWED_MODELS.some((allowed) => 
          modelName.toLowerCase().includes(allowed.toLowerCase()),
        );
      }
    }

    // Check OpenAI model restrictions
    if (OPENAI_ALLOWED_MODELS && OPENAI_ALLOWED_MODELS.length > 0) {
      if (modelName.includes('o3') || modelName.includes('o4')) {
        return OPENAI_ALLOWED_MODELS.some((allowed) => 
          modelName.toLowerCase().includes(allowed.toLowerCase()),
        );
      }
    }

    // No restrictions or not a restricted model type
    return true;
  }

  /**
   * Validate auto mode has available models
   */
  private validateAutoMode(): void {
    const availableModelsSync = this.getAvailableModelsSync();
    if (availableModelsSync.length === 0) {
      throw new Error(
        'Auto mode is enabled but no models are available after applying restrictions. ' +
        'Please check your OPENAI_ALLOWED_MODELS and GOOGLE_ALLOWED_MODELS settings.',
      );
    }
    logger.info(`Auto mode validated: ${availableModelsSync.length} models available`);
  }

  /**
   * Get available models synchronously (for validation)
   */
  private getAvailableModelsSync(): string[] {
    const models: string[] = [];

    // Check which providers are configured
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      const geminiModels = ['gemini-2.5-flash-preview-05-20', 'gemini-2.5-pro-preview-06-05', 'flash', 'pro'];
      models.push(...geminiModels.filter((m) => this.isModelAllowed(m)));
    }

    if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
      const openaiModels = ['o3', 'o3-mini', 'o3-pro', 'o4-mini', 'o4-mini-high'];
      models.push(...openaiModels.filter((m) => this.isModelAllowed(m)));
    }

    if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') {
      // Add some default OpenRouter models for auto mode validation
      const openrouterModels = [
        'google/gemini-2.5-flash-preview-05-20',
        'google/gemini-2.5-pro-preview',
        'anthropic/claude-3-haiku',
        'anthropic/claude-3-opus',
        'anthropic/claude-3-sonnet',
        'openai/o3',
        'openai/o3-mini',
        'openai/o4-mini',
      ];
      models.push(...openrouterModels.filter((m) => this.isModelAllowed(m)));
    }

    return models;
  }

  /**
   * Get model capabilities from any provider
   */
  async getModelCapabilities(modelName: string): Promise<ModelCapabilities | null> {
    const provider = await this.getProviderForModel(modelName);
    if (provider) {
      return provider.getModelCapabilities(modelName);
    }

    // Check custom models config
    const customModel = this.customModelsConfig?.models.find(
      (m) => m.model_name === modelName || m.aliases.includes(modelName),
    );

    if (customModel) {
      // Return basic capabilities from config
      return {
        provider: customModel.is_custom ? ProviderType.CUSTOM : ProviderType.OPENROUTER,
        modelName: customModel.model_name,
        friendlyName: customModel.description,
        contextWindow: customModel.context_window,
        supportsExtendedThinking: customModel.supports_extended_thinking,
        supportsSystemPrompts: true,
        supportsStreaming: false,
        supportsFunctionCalling: customModel.supports_function_calling,
        supportsJsonMode: customModel.supports_json_mode,
        temperatureConstraint: new (await import('./base.js')).RangeTemperatureConstraint(0, 2, 0.7),
      };
    }

    return null;
  }

  /**
   * Reset the registry (mainly for testing)
   */
  reset(): void {
    this.providers.clear();
    this.providerFactories.clear();
    this.customModelsConfig = null;
    this.initialized = false;
  }
}

// Export singleton instance
export const modelProviderRegistry = ModelProviderRegistry.getInstance();