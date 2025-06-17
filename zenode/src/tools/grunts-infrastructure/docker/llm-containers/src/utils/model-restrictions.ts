/**
 * Model Restriction Service
 *
 * This module provides centralized management of model usage restrictions
 * based on environment variables. It allows organizations to limit which
 * models can be used from each provider for cost control, compliance, or
 * standardization purposes.
 *
 * Environment Variables:
 * - OPENAI_ALLOWED_MODELS: Comma-separated list of allowed OpenAI models
 * - GOOGLE_ALLOWED_MODELS: Comma-separated list of allowed Gemini models
 * - OPENROUTER_ALLOWED_MODELS: Comma-separated list of allowed OpenRouter models
 *
 * Example:
 *   OPENAI_ALLOWED_MODELS=o3-mini,o4-mini
 *   GOOGLE_ALLOWED_MODELS=flash
 *   OPENROUTER_ALLOWED_MODELS=opus,sonnet,mistral
 */

import { logger } from './logger.js';
import { ProviderType } from '../types/providers.js';

/**
 * Centralized service for managing model usage restrictions.
 *
 * This service:
 * 1. Loads restrictions from environment variables at startup
 * 2. Validates restrictions against known models
 * 3. Provides a simple interface to check if a model is allowed
 */
export class ModelRestrictionService {
  // Environment variable names
  private static readonly ENV_VARS: Record<ProviderType, string> = {
    [ProviderType.GOOGLE]: 'GOOGLE_ALLOWED_MODELS',
    [ProviderType.OPENAI]: 'OPENAI_ALLOWED_MODELS',
    [ProviderType.OPENROUTER]: 'OPENROUTER_ALLOWED_MODELS',
    [ProviderType.CUSTOM]: 'CUSTOM_ALLOWED_MODELS',
  };

  private restrictions: Map<ProviderType, Set<string>> = new Map();

  constructor() {
    this.loadFromEnv();
  }

  /**
   * Load restrictions from environment variables.
   */
  private loadFromEnv(): void {
    for (const [providerType, envVar] of Object.entries(ModelRestrictionService.ENV_VARS)) {
      const envValue = process.env[envVar];

      if (!envValue || envValue === '') {
        // Not set or empty - no restrictions (allow all models)
        logger.debug(`${envVar} not set or empty - all ${providerType} models allowed`);
        continue;
      }

      // Parse comma-separated list
      const models = new Set<string>();
      for (const model of envValue.split(',')) {
        const cleaned = model.trim().toLowerCase();
        if (cleaned) {
          models.add(cleaned);
        }
      }

      if (models.size > 0) {
        this.restrictions.set(providerType as ProviderType, models);
        logger.info(`${providerType} allowed models: ${Array.from(models).sort().join(', ')}`);
      } else {
        // All entries were empty after cleaning - treat as no restrictions
        logger.debug(`${envVar} contains only whitespace - all ${providerType} models allowed`);
      }
    }
  }

  /**
   * Validate restrictions against known models from providers.
   *
   * This should be called after providers are initialized to warn about
   * typos or invalid model names in the restriction lists.
   *
   * @param providerInstances - Map of provider type to provider instance
   */
  validateAgainstKnownModels(providerInstances: Map<ProviderType, any>): void {
    for (const [providerType, allowedModels] of this.restrictions.entries()) {
      const provider = providerInstances.get(providerType);
      if (!provider) {
        continue;
      }

      // Get all supported models (including aliases)
      const supportedModels = new Set<string>();

      // For providers that have SUPPORTED_MODELS
      if (provider.SUPPORTED_MODELS || provider.supportedModels) {
        const supportedModelsObj = provider.SUPPORTED_MODELS || provider.supportedModels;
        
        for (const [modelName, config] of Object.entries(supportedModelsObj)) {
          // Add the model name (lowercase)
          supportedModels.add(modelName.toLowerCase());

          // If it's an alias (string value), add the target too
          if (typeof config === 'string') {
            supportedModels.add(config.toLowerCase());
          }
        }
      }

      // Check each allowed model
      for (const allowedModel of allowedModels) {
        if (!supportedModels.has(allowedModel)) {
          logger.warn(
            `Model '${allowedModel}' in ${ModelRestrictionService.ENV_VARS[providerType]} ` +
              `is not a recognized ${providerType} model. ` +
              `Please check for typos. Known models: ${Array.from(supportedModels).sort().join(', ')}`,
          );
        }
      }
    }
  }

  /**
   * Check if a model is allowed for a specific provider.
   *
   * @param providerType - The provider type (OPENAI, GOOGLE, etc.)
   * @param modelName - The canonical model name (after alias resolution)
   * @param originalName - The original model name before alias resolution (optional)
   * @returns True if allowed (or no restrictions), False if restricted
   */
  isAllowed(providerType: ProviderType, modelName: string, originalName?: string): boolean {
    const allowedSet = this.restrictions.get(providerType);
    if (!allowedSet) {
      // No restrictions for this provider
      return true;
    }

    // Check both the resolved name and original name (if different)
    const namesToCheck = new Set([modelName.toLowerCase()]);
    if (originalName && originalName.toLowerCase() !== modelName.toLowerCase()) {
      namesToCheck.add(originalName.toLowerCase());
    }

    // If any of the names is in the allowed set, it's allowed
    return Array.from(namesToCheck).some((name) => allowedSet.has(name));
  }

  /**
   * Get the set of allowed models for a provider.
   *
   * @param providerType - The provider type
   * @returns Set of allowed model names, or undefined if no restrictions
   */
  getAllowedModels(providerType: ProviderType): Set<string> | undefined {
    return this.restrictions.get(providerType);
  }

  /**
   * Check if a provider has any restrictions.
   *
   * @param providerType - The provider type
   * @returns True if restrictions exist, False otherwise
   */
  hasRestrictions(providerType: ProviderType): boolean {
    return this.restrictions.has(providerType);
  }

  /**
   * Filter a list of models based on restrictions.
   *
   * @param providerType - The provider type
   * @param models - List of model names to filter
   * @returns Filtered list containing only allowed models
   */
  filterModels(providerType: ProviderType, models: string[]): string[] {
    if (!this.hasRestrictions(providerType)) {
      return models;
    }

    return models.filter((model) => this.isAllowed(providerType, model));
  }

  /**
   * Get a summary of all restrictions for logging/debugging.
   *
   * @returns Map with provider names and their restrictions
   */
  getRestrictionSummary(): Record<string, string[]> {
    const summary: Record<string, string[]> = {};
    
    for (const [providerType, allowedSet] of this.restrictions.entries()) {
      if (allowedSet && allowedSet.size > 0) {
        summary[providerType] = Array.from(allowedSet).sort();
      } else {
        summary[providerType] = [];
      }
    }

    return summary;
  }
}

// Global instance (singleton pattern)
let restrictionServiceInstance: ModelRestrictionService | null = null;

/**
 * Get the global restriction service instance.
 *
 * @returns The singleton ModelRestrictionService instance
 */
export function getRestrictionService(): ModelRestrictionService {
  if (!restrictionServiceInstance) {
    restrictionServiceInstance = new ModelRestrictionService();
  }
  return restrictionServiceInstance;
}