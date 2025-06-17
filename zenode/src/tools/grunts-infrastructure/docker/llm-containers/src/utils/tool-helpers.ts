/**
 * Shared utilities for tool implementations
 * 
 * This module provides common functionality used across multiple tools
 * to reduce code duplication and ensure consistent behavior.
 */

import { ToolOutput } from '../types/tools.js';
import { MCP_PROMPT_SIZE_LIMIT } from '../config.js';

/**
 * Format a clarification request as JSON
 * Used when tools need additional information to proceed
 */
export function formatClarificationRequest(
  question: string,
  filesNeeded: string[]
): string {
  return JSON.stringify({
    status: 'clarification_required',
    question,
    files_needed: filesNeeded,
  });
}

/**
 * Check if a prompt exceeds size limits
 * Returns a ToolOutput error if the prompt is too large
 */
export function checkPromptSize(
  prompt: string,
  fieldName: string = 'prompt'
): ToolOutput | null {
  if (prompt.length > MCP_PROMPT_SIZE_LIMIT) {
    return {
      status: 'error',
      content: `The ${fieldName} exceeds the MCP protocol limit of ${MCP_PROMPT_SIZE_LIMIT} characters (${prompt.length} chars). ` +
        'Please provide large content as file references instead.',
      content_type: 'text',
    };
  }
  return null;
}

/**
 * Format a response with next steps guidance
 * Used by tools that want to encourage continued work
 */
export function formatResponseWithNextSteps(
  response: string,
  nextSteps: string
): string {
  return `${response}\n\n---\n\n**Next Steps:** ${nextSteps}`;
}

/**
 * Format a focused review required response
 * Used when scope is too large for effective analysis
 */
export function formatFocusedReviewRequired(
  reason: string,
  suggestion: string
): string {
  return JSON.stringify({
    status: 'focused_review_required',
    reason,
    suggestion,
  });
}

/**
 * Format a test sample needed response
 * Used by testgen when framework detection fails
 */
export function formatTestSampleNeeded(reason: string): string {
  return JSON.stringify({
    status: 'test_sample_needed',
    reason,
  });
}

/**
 * Format a more tests required response
 * Used by testgen when comprehensive coverage requires multiple iterations
 */
export function formatMoreTestsRequired(pendingTests: string): string {
  return JSON.stringify({
    status: 'more_tests_required',
    pending_tests: pendingTests,
  });
}

/**
 * Format a full codereview required response
 * Used by analyze tool when escalation is needed
 */
export function formatFullCodereviewRequired(reason: string): string {
  return JSON.stringify({
    status: 'full_codereview_required',
    important: "Please use zen's codereview tool instead",
    reason,
  });
}

/**
 * Build web search instructions for tools
 */
export function buildWebSearchInstruction(
  enabled: boolean,
  suggestions: string
): string {
  if (!enabled) return '';
  
  return `\n\nWEB SEARCH: You can suggest searches when current information would be helpful. ` +
    `Format: "I would benefit from searching for: [specific query]"\n\n${suggestions}`;
}

/**
 * Parse special status responses from tool output
 * Returns the parsed object or null if not a special status
 */
export function parseSpecialStatus(response: string): any | null {
  // Look for JSON responses that indicate special statuses
  const jsonMatch = response.match(/^\s*\{[\s\S]*\}\s*$/);
  if (!jsonMatch) return null;
  
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.status && typeof parsed.status === 'string') {
      return parsed;
    }
  } catch {
    // Not valid JSON, continue normal processing
  }
  
  return null;
}

/**
 * Extract thinking mode description for schema
 */
export function getThinkingModeDescription(defaultMode?: string): string {
  const base = "Thinking depth: minimal (0.5% of model max), low (8%), medium (33%), high (67%), max (100% of model max)";
  if (defaultMode) {
    return `${base}. Defaults to '${defaultMode}' if not specified.`;
  }
  return base;
}