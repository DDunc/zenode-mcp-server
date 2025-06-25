/**
 * Configuration and constants for Zenode MCP Server
 *
 * This module centralizes all configuration settings for the Zenode MCP Server.
 * It defines model configurations, token limits, temperature defaults, and other
 * constants used throughout the application.
 *
 * Configuration values can be overridden by environment variables where appropriate.
 */

import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Load environment variables
dotenv.config();

// Version and metadata
// These values are used in server responses and for tracking releases
// IMPORTANT: This is the single source of truth for version and author info
// Semantic versioning: MAJOR.MINOR.PATCH
export const VERSION = '1.0.0';
// Last update date in ISO format
export const UPDATED = new Date().toISOString().split('T')[0];
// Primary maintainer
export const AUTHOR = 'Zenode Team';

// Model configuration
// DEFAULT_MODEL: The default model used for all AI operations
// This should be a stable, high-performance model suitable for code analysis
// Can be overridden by setting DEFAULT_MODEL environment variable
// Special value "auto" means Claude should pick the best model for each task
export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'auto';

// Vision/Image Analysis Configuration
// DEFAULT_VISION_MODEL: The default model used specifically for image analysis tasks
// Using GPT-4o for reliable vision capabilities via OpenRouter
// Can be overridden by setting DEFAULT_VISION_MODEL environment variable to meta-llama/llama-3.2-11b-vision-instruct
export const DEFAULT_VISION_MODEL = process.env.DEFAULT_VISION_MODEL || 'openai/gpt-4o';

// Auto mode detection - when DEFAULT_MODEL is "auto", Claude picks the model
export const IS_AUTO_MODE = DEFAULT_MODEL.toLowerCase() === 'auto';

// Model capabilities descriptions for auto mode
// These help Claude choose the best model for each task
//
// IMPORTANT: These are the built-in natively supported models:
// - When GEMINI_API_KEY is set: Enables "flash", "pro" (and their full names)
// - When OPENAI_API_KEY is set: Enables "o3", "o3mini", "o4-mini", "o4-mini-high"
// - When both are set: All models below are available
// - When neither is set but OpenRouter/Custom API is configured: These model
//   aliases will automatically map to equivalent models via the proxy provider
//
// In auto mode (DEFAULT_MODEL=auto), Claude will see these descriptions and
// intelligently select the best model for each task. The descriptions appear
// in the tool schema to guide Claude's selection based on task requirements.
export const MODEL_CAPABILITIES_DESC: Record<string, string> = {
  // Gemini models - Available when GEMINI_API_KEY is configured
  flash: 'Ultra-fast (1M context) - Quick analysis, simple queries, rapid iterations',
  pro: 'Deep reasoning + thinking mode (1M context) - Complex problems, architecture, deep analysis',
  // OpenAI models - Available when OPENAI_API_KEY is configured
  o3: 'Strong reasoning (200K context) - Logical problems, code generation, systematic analysis',
  'o3-mini': 'Fast O3 variant (200K context) - Balanced performance/speed, moderate complexity',
  'o3-pro':
    'Professional-grade reasoning (200K context) - EXTREMELY EXPENSIVE: Only for the most complex problems requiring universe-scale complexity analysis OR when the user explicitly asks for this model. Use sparingly for critical architectural decisions or exceptionally complex debugging that other models cannot handle.',
  'o4-mini': 'Latest reasoning model (200K context) - Optimized for shorter contexts, rapid reasoning',
  'o4-mini-high': 'Enhanced O4 mini (200K context) - Higher reasoning effort for complex tasks',
  // Vision/Image Analysis Models (via OpenRouter) - June 2025 Recommendations
  'openai/gpt-4o': 'TOP VISION MODEL (20MB images) - Superior multimodal: text, audio, images, video. Best for image analysis, OCR, face recognition, UI/UX review',
  'openai/gpt-4o-mini': 'Fast vision model (20MB images) - Cost-effective multimodal with excellent image understanding capabilities',
  'meta-llama/llama-4-maverick-17b-instruct': 'Advanced vision (15MB images, 1M context) - Latest Llama 4 with 128 experts, optimized for complex visual reasoning',
  'anthropic/claude-3-sonnet': 'Reliable vision (5MB images) - Excellent for code screenshot analysis, UI review, technical diagrams',
  'google/gemini-2.5-pro-preview': 'High-capacity vision (16MB images, 1M context) - Best for document OCR, long visual content analysis',
  // Full model names also supported (for explicit specification)
  'gemini-2.5-flash-preview-05-20':
    'Ultra-fast (1M context) - Quick analysis, simple queries, rapid iterations',
  'gemini-2.5-pro-preview-06-05':
    'Deep reasoning + thinking mode (1M context) - Complex problems, architecture, deep analysis',
};

// OpenRouter/Custom API Fallback Behavior:
// When only OpenRouter or Custom API is configured (no native API keys), these
// model aliases automatically map to equivalent models through the proxy:
// - "flash" → "google/gemini-2.5-flash-preview-05-20" (via OpenRouter)
// - "pro" → "google/gemini-2.5-pro-preview-06-05" (via OpenRouter)
// - "o3" → "openai/o3" (via OpenRouter)
// - "o3mini" → "openai/o3-mini" (via OpenRouter)
// - "o4-mini" → "openai/o4-mini" (via OpenRouter)
// - "o4-mini-high" → "openai/o4-mini-high" (via OpenRouter)
//
// This ensures the same model names work regardless of which provider is configured.

// Temperature defaults for different tool types
// Temperature controls the randomness/creativity of model responses
// Lower values (0.0-0.3) produce more deterministic, focused responses
// Higher values (0.7-1.0) produce more creative, varied responses

// TEMPERATURE_ANALYTICAL: Used for tasks requiring precision and consistency
// Ideal for code review, debugging, and error analysis where accuracy is critical
export const TEMPERATURE_ANALYTICAL = 0.2; // For code review, debugging

// TEMPERATURE_BALANCED: Middle ground for general conversations
// Provides a good balance between consistency and helpful variety
export const TEMPERATURE_BALANCED = 0.5; // For general chat

// TEMPERATURE_CREATIVE: Higher temperature for exploratory tasks
// Used when brainstorming, exploring alternatives, or architectural discussions
export const TEMPERATURE_CREATIVE = 0.7; // For architecture, deep thinking

// TEMPERATURE_CONSENSUS: Lower temperature for consistent consensus analysis
// Used for multi-model consensus to ensure more deterministic and comparable responses
export const TEMPERATURE_CONSENSUS = 0.2; // For consensus analysis

// Thinking Mode Defaults
// DEFAULT_THINKING_MODE_THINKDEEP: Default thinking depth for extended reasoning tool
// Higher modes use more computational budget but provide deeper analysis
export const DEFAULT_THINKING_MODE_THINKDEEP = process.env.DEFAULT_THINKING_MODE_THINKDEEP || 'high';

// MCP Protocol Limits
// MCP_PROMPT_SIZE_LIMIT: Maximum character size for prompts sent directly through MCP
// The MCP protocol has a combined request+response limit of ~25K tokens.
// To ensure we have enough space for responses, we limit direct prompt input
// to 50K characters (roughly ~10-12K tokens). Larger prompts must be sent
// as files to bypass MCP's token constraints.
export const MCP_PROMPT_SIZE_LIMIT = 50_000; // 50K characters

// Threading configuration
// Simple Redis-based conversation threading for stateless MCP environment
// Set REDIS_URL environment variable to connect to your Redis instance
export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380/0';

// Environment configuration
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const LOG_LEVEL = process.env.LOG_LEVEL || 'INFO';
// MCP Workspace - Should provide access to the full project, not just zenode subdirectory
// Default to parent directory of zenode to access the entire project
// If running from zenode directory, go up one level to project root
const currentDir = process.cwd();
const isInZenodeDir = currentDir.endsWith('zenode');
const defaultWorkspace = isInZenodeDir ? path.join(currentDir, '..') : currentDir;
export const MCP_WORKSPACE = process.env.MCP_WORKSPACE || defaultWorkspace;

// Project detection - auto-detect when zenode is being used in a project
export function detectProjectRoot(startPath?: string): string | null {
  const searchPath = startPath || process.cwd();
  const indicators = ['.git', 'package.json', 'Cargo.toml', 'pyproject.toml', 'go.mod', '.project'];
  
  let currentPath = path.resolve(searchPath);
  while (currentPath !== path.dirname(currentPath)) {
    for (const indicator of indicators) {
      if (existsSync(path.join(currentPath, indicator))) {
        return currentPath;
      }
    }
    currentPath = path.dirname(currentPath);
  }
  return null;
}

// Auto-detect project root and suggest mounting
export const PROJECT_ROOT = detectProjectRoot();
export const IS_IN_PROJECT = PROJECT_ROOT !== null;
export const NEEDS_PROJECT_MOUNT = IS_IN_PROJECT && !process.env.MCP_PROJECT_MOUNTED;

// API Keys
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
export const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
export const SEARCHAPI_KEY = process.env.SEARCHAPI_KEY;
export const SERPAPI_KEY = process.env.SERPAPI_KEY;
export const CUSTOM_API_URL = process.env.CUSTOM_API_URL;
export const CUSTOM_API_KEY = process.env.CUSTOM_API_KEY || '';
export const CUSTOM_MODEL_NAME = process.env.CUSTOM_MODEL_NAME || 'llama3.2';

// Model restrictions (if any)
export const OPENAI_ALLOWED_MODELS = process.env.OPENAI_ALLOWED_MODELS?.split(',').map((m) => m.trim());
export const GOOGLE_ALLOWED_MODELS = process.env.GOOGLE_ALLOWED_MODELS?.split(',').map((m) => m.trim());
export const OPENROUTER_ALLOWED_MODELS = process.env.OPENROUTER_ALLOWED_MODELS?.split(',').map((m) => m.trim());

// Enable expensive models (optional)
export const ENABLE_CLAUDE_OPUS = process.env.ENABLE_CLAUDE_OPUS === 'true';

// Advanced configuration options for maximum Python parity
export const MAX_CONVERSATION_TURNS = parseInt(process.env.MAX_CONVERSATION_TURNS || '20', 10);
export const CONVERSATION_TIMEOUT_HOURS = parseInt(process.env.CONVERSATION_TIMEOUT_HOURS || '3', 10);

// Consensus tool configuration
// DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION: Maximum instances per model+stance combination
// Prevents overwhelming the system with too many identical model configurations
// This matches the Python implementation limit for consistency
export const DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION = parseInt(
  process.env.DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION || '2', 
  10
);

// Validate configuration values
if (MAX_CONVERSATION_TURNS <= 0) {
  console.warn(`Invalid MAX_CONVERSATION_TURNS value (${MAX_CONVERSATION_TURNS}), using default of 20 turns`);
}

if (CONVERSATION_TIMEOUT_HOURS <= 0) {
  console.warn(`Invalid CONVERSATION_TIMEOUT_HOURS value (${CONVERSATION_TIMEOUT_HOURS}), using default of 3 hours`);
}

if (DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION <= 0) {
  console.warn(`Invalid DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION value (${DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION}), using default of 2 instances`);
}

// Helper function to check if any API is configured
export function hasAnyApiConfigured(): boolean {
  return !!(
    (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') ||
    (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') ||
    (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') ||
    CUSTOM_API_URL
  );
}

// Helper function to get configured providers
export function getConfiguredProviders(): string[] {
  const providers: string[] = [];
  
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    providers.push('Gemini');
  }
  
  if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
    providers.push('OpenAI');
  }
  
  if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') {
    providers.push('OpenRouter');
  }
  
  if (CUSTOM_API_URL) {
    providers.push(`Custom (${CUSTOM_API_URL})`);
  }
  
  return providers;
}