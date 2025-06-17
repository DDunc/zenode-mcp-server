/**
 * Token counting and management utilities
 */

import { encoding_for_model, Tiktoken } from 'tiktoken';
import { logger } from './logger.js';

// Cache for token encoders
const encoderCache = new Map<string, Tiktoken>();

/**
 * Get token encoder for a model
 */
function getEncoder(modelName: string): Tiktoken {
  // Normalize model name for tiktoken
  let encodingModel = 'gpt-3.5-turbo'; // Default fallback
  
  if (modelName.includes('gpt-4') || modelName.includes('o3') || modelName.includes('o4')) {
    encodingModel = 'gpt-4';
  } else if (modelName.includes('claude')) {
    // Claude uses similar tokenization to GPT
    encodingModel = 'gpt-4';
  }
  
  // Check cache
  let encoder = encoderCache.get(encodingModel);
  if (!encoder) {
    try {
      encoder = encoding_for_model(encodingModel as any);
      encoderCache.set(encodingModel, encoder);
    } catch (error) {
      logger.warn(`Failed to get encoder for ${encodingModel}, using default`);
      encoder = encoding_for_model('gpt-3.5-turbo');
      encoderCache.set(encodingModel, encoder);
    }
  }
  
  return encoder;
}

/**
 * Count tokens in a text string
 */
export function countTokens(text: string, modelName = 'gpt-3.5-turbo'): number {
  try {
    const encoder = getEncoder(modelName);
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    logger.warn('Failed to count tokens, using estimation:', error);
    // Fallback to rough estimation
    return Math.ceil(text.length / 4);
  }
}

/**
 * Count tokens in messages array
 */
export function countMessageTokens(
  messages: Array<{ role: string; content: string }>,
  modelName = 'gpt-3.5-turbo',
): number {
  let totalTokens = 0;
  
  // Each message has overhead tokens for formatting
  const messageOverhead = modelName.includes('gpt-4') ? 3 : 4;
  
  for (const message of messages) {
    totalTokens += messageOverhead; // Role and message separators
    totalTokens += countTokens(message.role, modelName);
    totalTokens += countTokens(message.content, modelName);
  }
  
  // Add tokens for message framing
  totalTokens += 3;
  
  return totalTokens;
}

/**
 * Check if content exceeds token limit
 */
export function checkTokenLimit(
  content: string,
  maxTokens: number,
  modelName = 'gpt-3.5-turbo',
): { exceedsLimit: boolean; tokenCount: number } {
  const tokenCount = countTokens(content, modelName);
  return {
    exceedsLimit: tokenCount > maxTokens,
    tokenCount,
  };
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokenLimit(
  text: string,
  maxTokens: number,
  modelName = 'gpt-3.5-turbo',
  addEllipsis = true,
): string {
  const encoder = getEncoder(modelName);
  const tokens = encoder.encode(text);
  
  if (tokens.length <= maxTokens) {
    return text;
  }
  
  // Reserve tokens for ellipsis if needed
  const effectiveMax = addEllipsis ? maxTokens - 3 : maxTokens;
  const truncatedTokens = tokens.slice(0, effectiveMax);
  
  try {
    let truncated = new TextDecoder().decode(truncatedTokens);
    if (addEllipsis) {
      truncated += '...';
    }
    return truncated;
  } catch (error) {
    // Fallback to character-based truncation
    const avgCharsPerToken = text.length / tokens.length;
    const maxChars = Math.floor(effectiveMax * avgCharsPerToken);
    let truncated = text.substring(0, maxChars);
    if (addEllipsis) {
      truncated += '...';
    }
    return truncated;
  }
}

/**
 * Split text into chunks that fit within token limit
 */
export function splitIntoTokenChunks(
  text: string,
  maxTokensPerChunk: number,
  modelName = 'gpt-3.5-turbo',
  overlap = 0,
): string[] {
  const encoder = getEncoder(modelName);
  const tokens = encoder.encode(text);
  
  if (tokens.length <= maxTokensPerChunk) {
    return [text];
  }
  
  const chunks: string[] = [];
  let startIdx = 0;
  
  while (startIdx < tokens.length) {
    const endIdx = Math.min(startIdx + maxTokensPerChunk, tokens.length);
    const chunkTokens = tokens.slice(startIdx, endIdx);
    
    try {
      const chunkText = new TextDecoder().decode(chunkTokens);
      chunks.push(chunkText);
    } catch (error) {
      // Fallback to character-based chunking
      const avgCharsPerToken = text.length / tokens.length;
      const startChar = Math.floor(startIdx * avgCharsPerToken);
      const endChar = Math.floor(endIdx * avgCharsPerToken);
      chunks.push(text.substring(startChar, endChar));
    }
    
    // Move to next chunk with overlap
    startIdx = endIdx - overlap;
  }
  
  return chunks;
}

/**
 * Estimate tokens for different model providers
 */
export function estimateTokensForProvider(text: string, provider: string): number {
  let modelName = 'gpt-3.5-turbo';
  
  if (provider === 'openai' || provider.includes('o3') || provider.includes('o4')) {
    modelName = 'gpt-4';
  } else if (provider === 'anthropic' || provider.includes('claude')) {
    modelName = 'gpt-4'; // Claude uses similar tokenization
  }
  
  return countTokens(text, modelName);
}

/**
 * Clean up encoder cache (call periodically if needed)
 */
export function cleanupEncoders(): void {
  for (const [key, encoder] of encoderCache.entries()) {
    encoder.free();
    encoderCache.delete(key);
  }
}

// Clean up on process exit
process.on('exit', cleanupEncoders);
process.on('SIGINT', () => {
  cleanupEncoders();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanupEncoders();
  process.exit(0);
});