/**
 * Type definitions for MCP tools
 */

import { z } from 'zod';
import { MCPContent } from './mcp.js';
import { ModelProvider } from './providers.js';

export type ThinkingMode = 'minimal' | 'low' | 'medium' | 'high' | 'max';
export type ToolModelCategory = 'fast' | 'reasoning' | 'extended_reasoning' | 'vision' | 'all';

export const ToolModelCategory = {
  FAST: 'fast' as const,
  REASONING: 'reasoning' as const,
  EXTENDED_REASONING: 'extended_reasoning' as const,
  VISION: 'vision' as const,
  ALL: 'all' as const,
} as const;

export interface ToolRequest {
  model?: string;
  temperature?: number;
  thinking_mode?: ThinkingMode;
  use_websearch?: boolean;
  continuation_id?: string;
  [key: string]: any; // Allow tool-specific parameters
}

export interface ToolOutput {
  status: 'success' | 'error' | 'clarification_needed';
  content: string;
  content_type: 'text' | 'json' | 'markdown' | 'code';
  metadata?: Record<string, any>;
  continuation_offer?: ContinuationOffer | null;
}

export interface ContinuationOffer {
  thread_id: string;
  suggestions: string[];
  stats: ConversationStats;
}

export interface ConversationStats {
  total_turns: number;
  total_input_tokens: number;
  total_output_tokens: number;
  models_used: string[];
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  files?: string[]; // Files referenced in this specific turn
  images?: string[]; // Images referenced in this specific turn (zen compatibility)
  tool?: string; // Tool used for this turn (zen: tool_name)
  model?: string; // Specific model used (zen: model_name)
  metadata?: Record<string, any>; // Additional model info (zen: model_metadata)
}

export interface ConversationThread {
  id: string;
  thread_id: string;
  parent_thread_id?: string; // Parent thread for conversation chains (zen compatibility)
  tool_name: string;
  created_at: string;
  last_updated: string;
  turns: ConversationTurn[];
  initial_context?: Record<string, any>; // Original request parameters (zen compatibility)
  metadata: {
    tools_used: string[];
    total_input_tokens: number;
    total_output_tokens: number;
  };
}

export interface BaseTool {
  name: string;
  description: string;
  defaultTemperature: number;
  modelCategory: ToolModelCategory;
  
  getInputSchema(): any;
  getZodSchema(): z.ZodSchema;
  getSystemPrompt(): string;
  execute(args: ToolRequest): Promise<ToolOutput>;
}

// Tool-specific request interfaces
export interface ChatRequest extends ToolRequest {
  prompt: string;
  files?: string[];
}

export interface ThinkDeepRequest extends ToolRequest {
  prompt: string;
  problem_context?: string;
  focus_areas?: string[];
  files?: string[];
}

export interface CodeReviewRequest extends ToolRequest {
  files: string[];
  prompt: string;
  review_type?: 'full' | 'security' | 'performance' | 'quick';
  severity_filter?: 'critical' | 'high' | 'medium' | 'all';
  focus_on?: string;
  standards?: string;
}

export interface DebugRequest extends ToolRequest {
  prompt: string;
  error_context?: string;
  files?: string[];
  runtime_info?: string;
  previous_attempts?: string;
}

export interface AnalyzeRequest extends ToolRequest {
  files?: string[];
  prompt: string;
  analysis_type?: 'architecture' | 'performance' | 'security' | 'quality' | 'general';
  output_format?: 'summary' | 'detailed' | 'actionable';
}

export interface PrecommitRequest extends ToolRequest {
  path: string;
  prompt?: string;
  compare_to?: string;
  include_staged?: boolean;
  include_unstaged?: boolean;
  review_type?: 'full' | 'security' | 'performance' | 'quick';
  severity_filter?: 'critical' | 'high' | 'medium' | 'all';
  focus_on?: string;
  files?: string[];
  max_depth?: number;
}

export interface TestGenRequest extends ToolRequest {
  files: string[];
  prompt: string;
  test_examples?: string[];
}

export interface ConfigRequest extends ToolRequest {
  action: 'setup' | 'list' | 'validate' | 'reset';
  provider?: 'gemini' | 'openai' | 'openrouter' | 'custom' | 'browserbase' | 'searchapi' | 'serpapi';
  api_key?: string;
  custom_url?: string;
  custom_model?: string;
}

export interface VisitRequest extends ToolRequest {
  prompt?: string;
  action?: 'browse' | 'search' | 'reverse_image_search' | 'screenshot';
  url?: string;
  query?: string;
  engine?: 'google' | 'bing' | 'youtube' | 'auto';
  location?: string;
  take_screenshot?: boolean;
}

// Special status responses from tools
export interface ClarificationRequired {
  status: 'clarification_required';
  question: string;
  files_needed: string[];
}

export interface FocusedReviewRequired {
  status: 'focused_review_required';
  reason: string;
  suggestion: string;
}

export interface TestSampleNeeded {
  status: 'test_sample_needed';
  reason: string;
}

export interface MoreTestsRequired {
  status: 'more_tests_required';
  pending_tests: string;
}

export interface FullCodereviewRequired {
  status: 'full_codereview_required';
  important: string;
  reason: string;
}

// Schema validation helpers
export const ThinkingModeSchema = z.enum(['minimal', 'low', 'medium', 'high', 'max']);
export const ReviewTypeSchema = z.enum(['full', 'security', 'performance', 'quick']);
export const SeverityFilterSchema = z.enum(['critical', 'high', 'medium', 'all']);
export const AnalysisTypeSchema = z.enum(['architecture', 'performance', 'security', 'quality', 'general']);
export const OutputFormatSchema = z.enum(['summary', 'detailed', 'actionable']);