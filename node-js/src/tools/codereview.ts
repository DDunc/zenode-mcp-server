/**
 * CodeReview tool - Comprehensive code analysis and review
 * 
 * This tool provides professional-grade code review capabilities using
 * the chosen model's understanding of code patterns, best practices, and common issues.
 * It can analyze individual files or entire codebases, providing actionable
 * feedback categorized by severity.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { 
  CodeReviewRequest, 
  ToolOutput, 
  ToolModelCategory,
  ThinkingModeSchema,
  ReviewTypeSchema,
  SeverityFilterSchema,
} from '../types/tools.js';
import { CODEREVIEW_PROMPT } from '../systemprompts/codereview-prompt.js';
import { 
  TEMPERATURE_ANALYTICAL,
  IS_AUTO_MODE,
} from '../config.js';
import { 
  checkPromptSize, 
  formatClarificationRequest,
  formatFocusedReviewRequired,
  buildWebSearchInstruction,
  getThinkingModeDescription,
} from '../utils/tool-helpers.js';
import { logger } from '../utils/logger.js';

/**
 * Request validation schema
 */
const CodeReviewRequestSchema = z.object({
  files: z.array(z.string()),
  prompt: z.string(),
  model: z.string().optional(),
  review_type: ReviewTypeSchema.default('full'),
  focus_on: z.string().optional(),
  standards: z.string().optional(),
  severity_filter: SeverityFilterSchema.default('all'),
  temperature: z.number().min(0).max(1).optional(),
  thinking_mode: ThinkingModeSchema.optional(),
  use_websearch: z.boolean().default(true),
  continuation_id: z.string().optional(),
});

export class CodeReviewTool extends BaseTool {
  name = 'codereview';
  
  description = 
    'PROFESSIONAL CODE REVIEW - Comprehensive analysis for bugs, security, and quality. ' +
    'Supports both individual files and entire directories/projects. ' +
    'Use this when you need to review code, check for issues, find bugs, or perform security audits. ' +
    'ALSO use this to validate claims about code, verify code flow and logic, confirm assertions, ' +
    'cross-check functionality, or investigate how code actually behaves when you need to be certain. ' +
    'I\'ll identify issues by severity (Critical→High→Medium→Low) with specific fixes. ' +
    'Supports focused reviews: security, performance, or quick checks. ' +
    'Choose thinking_mode based on review scope: \'low\' for small code snippets, ' +
    '\'medium\' for standard files/modules (default), \'high\' for complex systems/architectures, ' +
    '\'max\' for critical security audits or large codebases requiring deepest analysis. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.REASONING;
  
  getInputSchema(): any {
    const schema = {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Code files or directories to review (must be absolute paths)',
        },
        prompt: {
          type: 'string',
          description: 'User\'s summary of what the code does, expected behavior, constraints, and review objectives',
        },
        model: {
          type: 'string',
          description: IS_AUTO_MODE 
            ? this.getModelDescription()
            : `Model to use. Default: ${process.env.DEFAULT_MODEL || 'auto'}`,
        },
        review_type: {
          type: 'string',
          enum: ['full', 'security', 'performance', 'quick'],
          default: 'full',
          description: 'Type of review to perform',
        },
        focus_on: {
          type: 'string',
          description: 'Specific aspects to focus on, or additional context that would help understand areas of concern',
        },
        standards: {
          type: 'string',
          description: 'Coding standards to enforce',
        },
        severity_filter: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'all'],
          default: 'all',
          description: 'Minimum severity level to report',
        },
        temperature: {
          type: 'number',
          description: 'Temperature (0-1, default 0.2 for consistency)',
          minimum: 0,
          maximum: 1,
        },
        thinking_mode: {
          type: 'string',
          enum: ['minimal', 'low', 'medium', 'high', 'max'],
          description: getThinkingModeDescription(),
        },
        use_websearch: {
          type: 'boolean',
          description: 'Enable web search for documentation, best practices, and current information. Particularly useful for: brainstorming sessions, architectural design discussions, exploring industry best practices, working with specific frameworks/technologies, researching solutions to complex problems, or when current documentation and community insights would enhance the analysis.',
          default: true,
        },
        continuation_id: {
          type: 'string',
          description: 'Thread continuation ID for multi-turn conversations. Can be used to continue conversations across different tools. Only provide this if continuing a previous conversation thread.',
        },
      },
      required: ['files', 'prompt'],
    };
    
    // Add model to required fields if in auto mode
    if (IS_AUTO_MODE) {
      schema.required.push('model');
    }
    
    return schema;
  }
  
  getSystemPrompt(): string {
    return CODEREVIEW_PROMPT;
  }
  
  async execute(args: CodeReviewRequest): Promise<ToolOutput> {
    try {
      // Validate request
      const validatedRequest = CodeReviewRequestSchema.parse(args);
      logger.debug('CodeReview request validated', { 
        files: validatedRequest.files.length,
        reviewType: validatedRequest.review_type,
        severityFilter: validatedRequest.severity_filter,
      });
      
      // Check focus_on size if provided
      if (validatedRequest.focus_on) {
        const sizeCheck = checkPromptSize(validatedRequest.focus_on, 'focus_on');
        if (sizeCheck) {
          return sizeCheck;
        }
      }
      
      // Prepare the prompt
      const fullPrompt = await this.preparePrompt(validatedRequest);
      
      // Select model
      const model = await this.selectModel(validatedRequest.model);
      
      // Get conversation context if continuing
      let conversationContext: string | undefined;
      if (validatedRequest.continuation_id) {
        logger.info(`Continuing conversation thread: ${validatedRequest.continuation_id}`);
      }
      
      // Create model request
      const modelRequest = await this.createModelRequest(
        fullPrompt,
        this.getSystemPrompt(),
        model,
        validatedRequest.temperature || this.defaultTemperature,
        validatedRequest.use_websearch,
        conversationContext,
      );
      
      // Make API call (this would be handled by the provider)
      logger.info('Executing code review', { 
        model,
        reviewType: validatedRequest.review_type,
      });
      
      // For now, return a mock response showing the structure
      const mockResponse = `
🔴 CRITICAL: SQL injection vulnerability in user.js:45
→ Fix: Use parameterized queries instead of string concatenation

🟠 HIGH: Missing error handling in api.js:120
→ Fix: Wrap async operations in try-catch blocks

• **Overall code quality summary**: The code shows good structure but has critical security issues.
• **Top 3 priority fixes**:
  - Fix SQL injection vulnerability
  - Add proper error handling
  - Implement input validation
• **Positive aspects**: Clean function naming, good module separation`;
      
      return this.formatOutput(
        mockResponse,
        'success',
        'text',
      );
      
    } catch (error) {
      logger.error('CodeReview execution error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request parameters: ${error.errors.map(e => e.message).join(', ')}`,
          'error',
          'text',
        );
      }
      
      return this.formatOutput(
        `Error during review: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        'text',
      );
    }
  }
  
  private async preparePrompt(request: CodeReviewRequest): Promise<string> {
    // Read all files
    const fileContents = await this.readFilesSecurely(request.files);
    
    // Format file content
    const formattedFiles = Object.entries(fileContents)
      .map(([path, content]) => `=== FILE: ${path} ===\n${content}\n=== END FILE ===`)
      .join('\n\n');
    
    // Build review instructions based on review type
    const reviewInstructions = this.buildReviewInstructions(request);
    
    // Add web search instruction if enabled
    const websearchInstruction = buildWebSearchInstruction(
      request.use_websearch !== false,
      `When reviewing code, consider if searches for these would help:
- Security best practices for the frameworks/libraries used
- Known vulnerabilities in dependencies
- Performance optimization techniques
- Design patterns and architectural guidance`
    );
    
    // Combine everything
    const fullPrompt = `${reviewInstructions}${websearchInstruction}

=== USER CONTEXT ===
${request.prompt}
=== END CONTEXT ===

${request.focus_on ? `\n=== SPECIFIC FOCUS ===\n${request.focus_on}\n=== END FOCUS ===\n` : ''}

=== CODE TO REVIEW ===
${formattedFiles}
=== END CODE ===

Please review this code according to the instructions above.`;
    
    return fullPrompt;
  }
  
  private buildReviewInstructions(request: CodeReviewRequest): string {
    const parts: string[] = [];
    
    // Add review type specific instructions
    switch (request.review_type) {
      case 'security':
        parts.push('FOCUS: Prioritize security vulnerabilities and data protection issues.');
        break;
      case 'performance':
        parts.push('FOCUS: Prioritize performance bottlenecks and optimization opportunities.');
        break;
      case 'quick':
        parts.push('FOCUS: Quick review for major issues only - Critical and High severity.');
        break;
      default:
        parts.push('FOCUS: Comprehensive review covering all aspects.');
    }
    
    // Add severity filter
    if (request.severity_filter !== 'all') {
      const severityMap = {
        critical: 'Critical issues only',
        high: 'High and Critical issues only',
        medium: 'Medium, High, and Critical issues only',
      };
      const filter = request.severity_filter as keyof typeof severityMap;
      parts.push(`SEVERITY FILTER: Report ${severityMap[filter]}.`);
    }
    
    // Add coding standards if provided
    if (request.standards) {
      parts.push(`\nCODING STANDARDS TO ENFORCE:\n${request.standards}`);
    }
    
    return parts.join('\n');
  }
}