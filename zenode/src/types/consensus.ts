/**
 * Type definitions for the Consensus tool
 * 
 * These types define the structure for multi-model consensus analysis,
 * including stance assignment, model configurations, and response formats.
 */

import { z } from 'zod';
import { ToolRequest } from './tools.js';

// Stance types for consensus analysis
export type ConsensusStance = 'for' | 'against' | 'neutral';

// Supported stance synonyms that get normalized
export type ConsensusStanceSynonyms = 
  | 'for' | 'support' | 'favor'           // Supportive stances → 'for'
  | 'against' | 'oppose' | 'critical'     // Critical stances → 'against'  
  | 'neutral';                            // Neutral stance → 'neutral'

export const ConsensusStance = {
  FOR: 'for' as const,
  AGAINST: 'against' as const,
  NEUTRAL: 'neutral' as const,
} as const;

// Stance synonym mappings for normalization
export const SUPPORTIVE_STANCES: Set<string> = new Set(['for', 'support', 'favor']);
export const CRITICAL_STANCES: Set<string> = new Set(['against', 'oppose', 'critical']);
export const NEUTRAL_STANCES: Set<string> = new Set(['neutral']);

/**
 * Configuration for a single model in consensus analysis
 */
export interface ModelConfig {
  /** Model name to use (e.g., 'o3', 'flash', 'pro', 'openai/gpt-4o') */
  model: string;
  
  /** Stance for this model - influences analysis perspective */
  stance?: ConsensusStance;
  
  /** Custom stance-specific instructions that override default stance prompts */
  stance_prompt?: string;
}

/**
 * Zod schema for ModelConfig validation
 */
export const ModelConfigSchema = z.object({
  model: z.string().min(1, "Model name cannot be empty"),
  stance: z.enum(['for', 'support', 'favor', 'against', 'oppose', 'critical', 'neutral'])
    .optional()
    .default('neutral'),
  stance_prompt: z.string().optional(),
});

/**
 * Request interface for consensus tool
 */
export interface ConsensusRequest extends ToolRequest {
  /** Description of what to get consensus on, with detailed context */
  prompt: string;
  
  /** List of model configurations for consensus analysis */
  models: ModelConfig[];
  
  /** Optional files for additional context (must be absolute paths) */
  files?: string[];
  
  /** Optional images for visual context or design references */
  images?: string[];
  
  /** Specific aspects to focus on (e.g., 'performance', 'security', 'user experience') */
  focus_areas?: string[];
}

/**
 * Zod schema for ConsensusRequest validation
 */
export const ConsensusRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  models: z.array(ModelConfigSchema).min(1, "At least one model must be specified"),
  files: z.array(z.string()).optional().default([]),
  images: z.array(z.string()).optional().default([]),
  focus_areas: z.array(z.string()).optional().default([]),
  
  // Base ToolRequest fields
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  thinking_mode: z.enum(['minimal', 'low', 'medium', 'high', 'max']).optional(),
  use_websearch: z.boolean().optional().default(true),
  continuation_id: z.string().optional(),
});

/**
 * Response from a single model in consensus analysis
 */
export interface ModelResponse {
  /** Model name that provided this response */
  model: string;
  
  /** Stance used for this model's analysis */
  stance: ConsensusStance;
  
  /** Status of the model response */
  status: 'success' | 'error';
  
  /** The model's structured analysis (if successful) */
  verdict?: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Additional metadata about the response */
  metadata?: {
    /** Provider type used for this model */
    provider?: string;
    
    /** Token usage information */
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
    
    /** Whether custom stance prompt was used */
    custom_stance_prompt?: boolean;
  };
}

/**
 * Complete consensus analysis result
 */
export interface ConsensusResponse {
  /** Overall status of the consensus operation */
  status: 'consensus_success' | 'consensus_failed';
  
  /** Models that provided successful responses */
  models_used: string[];
  
  /** Models that were skipped due to validation issues */
  models_skipped: string[];
  
  /** Models that encountered errors during execution */
  models_errored: string[];
  
  /** Individual responses from all models */
  responses: ModelResponse[];
  
  /** Guidance for Claude on synthesizing the results */
  next_steps: string;
}

/**
 * Normalized model configuration after validation
 */
export interface NormalizedModelConfig {
  model: string;
  stance: ConsensusStance;
  stance_prompt?: string;
}

/**
 * Model combination tracking for instance limits
 */
export interface ModelCombination {
  model: string;
  stance: ConsensusStance;
}

/**
 * Validation result for model configurations
 */
export interface ModelValidationResult {
  valid_configs: NormalizedModelConfig[];
  skipped_entries: string[];
}

/**
 * Stance prompt template definition
 */
export interface StancePromptTemplate {
  /** Template content with ethical constraints and guidelines */
  content: string;
  
  /** Brief description of this stance's purpose */
  description: string;
}

/**
 * Field descriptions for consensus tool schema
 */
export const CONSENSUS_FIELD_DESCRIPTIONS = {
  prompt: (
    "Description of what to get consensus on, testing objectives, and specific scope/focus areas. " +
    "Be as detailed as possible about the proposal, plan, or idea you want multiple perspectives on."
  ),
  models: (
    "List of model configurations for consensus analysis. Each model can have a specific stance and custom instructions. " +
    "Example: [{'model': 'o3', 'stance': 'for', 'stance_prompt': 'Focus on benefits and opportunities...'}, " +
    "{'model': 'flash', 'stance': 'against', 'stance_prompt': 'Identify risks and challenges...'}]. " +
    "Maximum 2 instances per model+stance combination."
  ),
  files: "Optional files or directories for additional context (must be FULL absolute paths - DO NOT SHORTEN)",
  images: (
    "Optional images showing expected UI changes, design requirements, " +
    "or visual references for the consensus analysis"
  ),
  focus_areas: "Specific aspects to focus on (e.g., 'performance', 'security', 'user experience')",
  model_config_model: "Model name to use (e.g., 'o3', 'flash', 'pro')",
  model_config_stance: (
    "Stance for this model. Supportive: 'for', 'support', 'favor'. " +
    "Critical: 'against', 'oppose', 'critical'. Neutral: 'neutral'. " +
    "Defaults to 'neutral'."
  ),
  model_config_stance_prompt: (
    "Custom stance-specific instructions for this model. " +
    "If provided, this will be used instead of the default stance prompt. " +
    "Should be clear, specific instructions about how this model should approach the analysis."
  ),
} as const;