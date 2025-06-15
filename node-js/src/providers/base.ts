/**
 * Base model provider interface and implementations
 */

import {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelCapabilities,
  ProviderType,
  TemperatureConstraint,
  Message,
} from '../types/providers.js';
import { logger } from '../utils/logger.js';

/**
 * Fixed temperature constraint for models that only support one temperature value
 */
export class FixedTemperatureConstraint implements TemperatureConstraint {
  constructor(private readonly value: number) {}

  validate(temperature: number): boolean {
    return Math.abs(temperature - this.value) < 1e-6; // Handle floating point precision
  }

  getCorrectedValue(temperature: number): number {
    return this.value;
  }

  getDescription(): string {
    return `Only supports temperature=${this.value}`;
  }

  getDefault(): number {
    return this.value;
  }
}

/**
 * Range temperature constraint for models supporting continuous temperature ranges
 */
export class RangeTemperatureConstraint implements TemperatureConstraint {
  constructor(
    private readonly minTemp: number,
    private readonly maxTemp: number,
    private readonly defaultTemp?: number,
  ) {}

  validate(temperature: number): boolean {
    return temperature >= this.minTemp && temperature <= this.maxTemp;
  }

  getCorrectedValue(temperature: number): number {
    return Math.max(this.minTemp, Math.min(this.maxTemp, temperature));
  }

  getDescription(): string {
    return `Supports temperature range [${this.minTemp}, ${this.maxTemp}]`;
  }

  getDefault(): number {
    return this.defaultTemp ?? (this.minTemp + this.maxTemp) / 2;
  }
}

/**
 * Discrete temperature constraint for models supporting only specific temperature values
 */
export class DiscreteTemperatureConstraint implements TemperatureConstraint {
  private readonly sortedValues: number[];
  private readonly defaultTemp: number;

  constructor(allowedValues: number[], defaultTemp?: number) {
    this.sortedValues = [...allowedValues].sort((a, b) => a - b);
    this.defaultTemp = defaultTemp ?? this.sortedValues[Math.floor(this.sortedValues.length / 2)] ?? 0.7;
  }

  validate(temperature: number): boolean {
    return this.sortedValues.some((val) => Math.abs(temperature - val) < 1e-6);
  }

  getCorrectedValue(temperature: number): number {
    // Find the closest allowed value
    let closest = this.sortedValues[0] ?? 0.7;
    let minDiff = Math.abs(temperature - closest);

    for (const val of this.sortedValues) {
      const diff = Math.abs(temperature - val);
      if (diff < minDiff) {
        minDiff = diff;
        closest = val;
      }
    }

    return closest;
  }

  getDescription(): string {
    return `Supports temperatures: ${this.sortedValues.join(', ')}`;
  }

  getDefault(): number {
    return this.defaultTemp;
  }
}

/**
 * Abstract base class for all model providers
 */
export abstract class BaseModelProvider implements ModelProvider {
  abstract readonly type: ProviderType;
  abstract readonly friendlyName: string;

  protected readonly modelCapabilities = new Map<string, ModelCapabilities>();
  protected readonly modelAliases = new Map<string, string>();

  constructor(protected readonly apiKey: string) {}

  /**
   * Generate a response from the model
   */
  abstract generateResponse(request: ModelRequest): Promise<ModelResponse>;

  /**
   * Get list of available models
   */
  getAvailableModels(): string[] {
    return Array.from(this.modelCapabilities.keys());
  }

  /**
   * Get capabilities for a specific model
   */
  getModelCapabilities(modelName: string): ModelCapabilities | null {
    // Try direct lookup first
    let capabilities = this.modelCapabilities.get(modelName);
    
    // If not found, try resolving alias
    if (!capabilities) {
      const resolvedName = this.resolveModelAlias(modelName);
      if (resolvedName) {
        capabilities = this.modelCapabilities.get(resolvedName);
      }
    }

    return capabilities || null;
  }

  /**
   * Validate if a model is supported
   */
  validateModel(modelName: string): boolean {
    return this.getModelCapabilities(modelName) !== null;
  }

  /**
   * Resolve a model alias to its full name
   */
  resolveModelAlias(alias: string): string | null {
    // Case-insensitive alias lookup
    const lowerAlias = alias.toLowerCase();
    
    // Check direct alias mapping
    for (const [key, value] of this.modelAliases.entries()) {
      if (key.toLowerCase() === lowerAlias) {
        return value;
      }
    }

    // Check if it's already a valid model name
    for (const modelName of this.modelCapabilities.keys()) {
      if (modelName.toLowerCase() === lowerAlias) {
        return modelName;
      }
    }

    return null;
  }

  /**
   * Validate and correct temperature for a model
   */
  protected validateTemperature(modelName: string, requestedTemp?: number): number {
    const capabilities = this.getModelCapabilities(modelName);
    if (!capabilities) {
      throw new Error(`Unknown model: ${modelName}`);
    }

    const constraint = capabilities.temperatureConstraint;
    const temp = requestedTemp ?? constraint.getDefault();

    if (!constraint.validate(temp)) {
      const corrected = constraint.getCorrectedValue(temp);
      logger.warn(
        `Temperature ${temp} invalid for model ${modelName}. ${constraint.getDescription()}. Using ${corrected}`,
      );
      return corrected;
    }

    return temp;
  }

  /**
   * Format messages for API request
   * Can be overridden by providers with specific formatting needs
   */
  protected formatMessages(messages: Message[], systemPrompt?: string): Message[] {
    if (systemPrompt) {
      return [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];
    }
    return messages;
  }

  /**
   * Calculate token usage (simplified estimation)
   * Should be overridden by providers with actual token counting
   */
  protected estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Log API request for debugging
   */
  protected logRequest(modelName: string, messages: Message[], temperature: number): void {
    logger.debug(`${this.friendlyName} API Request`, {
      model: modelName,
      messageCount: messages.length,
      temperature,
      lastMessage: messages[messages.length - 1]?.content.substring(0, 100) + '...',
    });
  }

  /**
   * Log API response for debugging
   */
  protected logResponse(modelName: string, response: ModelResponse): void {
    logger.debug(`${this.friendlyName} API Response`, {
      model: modelName,
      tokens: response.usage,
      contentLength: response.content.length,
      contentPreview: response.content.substring(0, 100) + '...',
    });
  }

  /**
   * Handle API errors with proper error messages
   */
  protected handleApiError(error: unknown, modelName: string): never {
    logger.error(`${this.friendlyName} API Error for model ${modelName}:`, error);

    if (error instanceof Error) {
      // Check for common API errors
      if (error.message.includes('401') || error.message.includes('authentication')) {
        throw new Error(`${this.friendlyName} API authentication failed. Please check your API key.`);
      }
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        throw new Error(`${this.friendlyName} API rate limit exceeded. Please try again later.`);
      }
      if (error.message.includes('404')) {
        throw new Error(`Model ${modelName} not found or not accessible.`);
      }
      
      throw new Error(`${this.friendlyName} API error: ${error.message}`);
    }

    throw new Error(`Unknown ${this.friendlyName} API error occurred`);
  }
}