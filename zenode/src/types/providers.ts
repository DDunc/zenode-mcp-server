/**
 * Type definitions for AI model providers
 */

import { ImageCapabilities } from './images.js';

export enum ProviderType {
  GOOGLE = 'google',
  OPENAI = 'openai',
  OPENROUTER = 'openrouter',
  CUSTOM = 'custom',
}

export interface TemperatureConstraint {
  validate(temperature: number): boolean;
  getCorrectedValue(temperature: number): number;
  getDescription(): string;
  getDefault(): number;
}

export interface ModelCapabilities {
  provider: ProviderType;
  modelName: string;
  friendlyName: string;
  contextWindow: number;
  supportsExtendedThinking: boolean;
  supportsSystemPrompts: boolean;
  supportsStreaming: boolean;
  supportsFunctionCalling: boolean;
  supportsJsonMode?: boolean;
  temperatureConstraint: TemperatureConstraint;
  temperatureRange?: [number, number]; // For backward compatibility
  // Image support capabilities
  supportsImages?: boolean;
  maxImageSizeMB?: number;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelResponse {
  content: string;
  usage: ModelUsage;
  modelName: string;
  friendlyName: string;
  provider: ProviderType;
  metadata?: Record<string, any>;
  totalTokens?: number; // Convenience getter
}

export interface ModelRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stopSequences?: string[];
  jsonMode?: boolean;
  stream?: boolean;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | VisionContent[];
}

export interface VisionContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

export interface ModelProvider {
  readonly type: ProviderType;
  readonly friendlyName: string;
  
  generateResponse(request: ModelRequest): Promise<ModelResponse>;
  getAvailableModels(): string[];
  getModelCapabilities(modelName: string): ModelCapabilities | null;
  validateModel(modelName: string): boolean;
  resolveModelAlias(alias: string): string | null;
  
  // Image support capability checking
  getImageCapabilities(modelName: string): Promise<ImageCapabilities>;
}

export type ProviderFactory = (apiKey?: string) => ModelProvider | Promise<ModelProvider>;

export interface CustomModelConfig {
  model_name: string;
  aliases: string[];
  context_window: number;
  supports_extended_thinking: boolean;
  supports_json_mode: boolean;
  supports_function_calling: boolean;
  supports_images?: boolean;
  is_custom?: boolean;
  description: string;
}

export interface CustomModelsConfig {
  _README?: any;
  models: CustomModelConfig[];
}