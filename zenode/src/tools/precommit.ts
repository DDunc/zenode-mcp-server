/**
 * Precommit tool - Pre-commit validation of git changes
 * 
 * This tool provides comprehensive pre-commit validation for git changes
 * across multiple repositories. It catches bugs, security issues, and
 * incomplete implementations before code is committed.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { 
  PrecommitRequest, 
  ToolOutput, 
  ToolModelCategory,
  ThinkingModeSchema,
  ReviewTypeSchema,
  SeverityFilterSchema,
} from '../types/tools.js';
import { PRECOMMIT_PROMPT } from '../systemprompts/precommit-prompt.js';
import { 
  TEMPERATURE_ANALYTICAL,
  IS_AUTO_MODE,
} from '../config.js';
import { 
  formatClarificationRequest,
  buildWebSearchInstruction,
  getThinkingModeDescription,
} from '../utils/tool-helpers.js';
import { 
  findGitRepositories,
  getGitStatus,
  getGitDiff,
  GitStatus,
  RepositoryDiff,
} from '../utils/git-utils.js';
import { logger } from '../utils/logger.js';
import { countTokens } from '../utils/token-utils.js';
import { modelProviderRegistry } from '../providers/registry.js';

/**
 * Request validation schema
 */
const PrecommitRequestSchema = z.object({
  path: z.string(),
  model: z.string().optional(),
  prompt: z.string().optional(),
  compare_to: z.string().optional(),
  include_staged: z.boolean().default(true),
  include_unstaged: z.boolean().default(true),
  focus_on: z.string().optional(),
  review_type: ReviewTypeSchema.default('full'),
  severity_filter: SeverityFilterSchema.default('all'),
  max_depth: z.number().default(5),
  temperature: z.number().min(0).max(1).optional(),
  thinking_mode: ThinkingModeSchema.optional(),
  files: z.array(z.string()).optional(),
  use_websearch: z.boolean().default(true),
  continuation_id: z.string().optional(),
});

/**
 * Repository changes information
 */
interface RepositoryChanges {
  repoPath: string;
  status: GitStatus;
  diff: string;
  diffTokens: number;
  truncated: boolean;
}

// Conservative token limit for diffs
const MAX_DIFF_TOKENS = 50000;
const MAX_TOKENS_PER_FILE = 10000;

export class PrecommitTool extends BaseTool {
  name = 'precommit';

  getZodSchema(): z.ZodSchema {
    return PrecommitRequestSchema;
  }
  
  description = 
    'PRECOMMIT VALIDATION FOR GIT CHANGES - ALWAYS use this tool before creating any git commit! ' +
    'IMPORTANT: This tool MUST be used when explicitly invoked (e.g., "zenode:precommit [path]"). ' +
    'Comprehensive pre-commit validation that catches bugs, security issues, incomplete implementations, ' +
    'and ensures changes match the original requirements. Searches all git repositories recursively and ' +
    'provides deep analysis of staged/unstaged changes. Essential for code quality and preventing bugs. ' +
    'Use this before committing, when reviewing changes, checking your changes, validating changes, ' +
    'or when you\'re about to commit or ready to commit. Claude should proactively suggest using this tool ' +
    'whenever the user mentions committing or when changes are complete. ' +
    'Choose thinking_mode based on changeset size: \'low\' for small focused changes, ' +
    '\'medium\' for standard commits (default), \'high\' for large feature branches or complex refactoring, ' +
    '\'max\' for critical releases or when reviewing extensive changes across multiple systems. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema(): any {
    const schema = {
      type: 'object',
      title: 'PrecommitRequest',
      description: 'Request model for precommit tool',
      properties: {
        path: {
          type: 'string',
          description: 'Starting directory to search for git repositories (must be absolute path).',
        },
        model: {
          type: 'string',
          description: IS_AUTO_MODE 
            ? this.getModelDescription()
            : `Model to use. Default: ${process.env.DEFAULT_MODEL || 'auto'}`,
        },
        prompt: {
          type: 'string',
          description: 'The original user request description for the changes. Provides critical context for the review.',
        },
        compare_to: {
          type: 'string',
          description: 'Optional: A git ref (branch, tag, commit hash) to compare against. If not provided, reviews local staged and unstaged changes.',
        },
        include_staged: {
          type: 'boolean',
          default: true,
          description: 'Include staged changes in the review. Only applies if \'compare_to\' is not set.',
        },
        include_unstaged: {
          type: 'boolean',
          default: true,
          description: 'Include uncommitted (unstaged) changes in the review. Only applies if \'compare_to\' is not set.',
        },
        focus_on: {
          type: 'string',
          description: 'Specific aspects to focus on (e.g., \'logic for user authentication\', \'database query efficiency\').',
        },
        review_type: {
          type: 'string',
          enum: ['full', 'security', 'performance', 'quick'],
          default: 'full',
          description: 'Type of review to perform on the changes.',
        },
        severity_filter: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'all'],
          default: 'all',
          description: 'Minimum severity level to report on the changes.',
        },
        max_depth: {
          type: 'integer',
          default: 5,
          description: 'Maximum depth to search for nested git repositories to prevent excessive recursion.',
        },
        temperature: {
          type: 'number',
          description: 'Temperature for the response (0.0 to 1.0). Lower values are more focused and deterministic.',
          minimum: 0,
          maximum: 1,
        },
        thinking_mode: {
          type: 'string',
          enum: ['minimal', 'low', 'medium', 'high', 'max'],
          description: getThinkingModeDescription(),
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional files or directories to provide as context (must be absolute paths). These files are not part of the changes but provide helpful context like configs, docs, or related code.',
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
      required: ['path'],
    };
    
    // Add model to required fields if in auto mode
    if (IS_AUTO_MODE) {
      schema.required.push('model');
    }
    
    return schema;
  }
  
  getSystemPrompt(): string {
    return PRECOMMIT_PROMPT;
  }
  
  async execute(args: PrecommitRequest): Promise<ToolOutput> {
    try {
      // Validate request
      const validatedRequest = PrecommitRequestSchema.parse(args);
      logger.debug('Precommit request validated', { 
        path: validatedRequest.path,
        compareToRef: validatedRequest.compare_to,
        maxDepth: validatedRequest.max_depth,
      });
      
      // Find git repositories
      const repositories = await findGitRepositories(
        validatedRequest.path, 
        validatedRequest.max_depth
      );
      
      if (repositories.length === 0) {
        return this.formatOutput(
          'No git repositories found in the specified path.',
          'error',
          'text',
        );
      }
      
      logger.info(`Found ${repositories.length} git repositories`);
      
      // Collect changes from all repositories
      const repoChanges = await this.collectRepositoryChanges(
        repositories,
        validatedRequest
      );
      
      // Filter out repositories with no changes
      const reposWithChanges = repoChanges.filter(rc => rc.diff.trim().length > 0);
      
      if (reposWithChanges.length === 0) {
        return this.formatOutput(
          'No changes found in any repository.',
          'success',
          'text',
        );
      }
      
      // Prepare the prompt
      const fullPrompt = await this.preparePrompt(validatedRequest, reposWithChanges);
      
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
      
      // Get provider and make actual API call
      const provider = await modelProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new Error(`No provider available for model: ${model}`);
      }
      
      logger.info('Executing precommit validation', { 
        model,
        repositories: reposWithChanges.length,
      });
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);
      
      // Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validatedRequest.prompt || 'Pre-commit validation',
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validatedRequest.continuation_id,
      );
      
      return this.formatOutput(
        response.content,
        'success',
        'text',
        {
          model_used: response.modelName,
          token_usage: response.usage,
        },
        continuationOffer,
      );
      
    } catch (error) {
      logger.error('Precommit execution error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request parameters: ${error.errors.map(e => e.message).join(', ')}`,
          'error',
          'text',
        );
      }
      
      return this.formatOutput(
        `Error during precommit validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        'text',
      );
    }
  }
  
  private async collectRepositoryChanges(
    repositories: string[],
    request: PrecommitRequest
  ): Promise<RepositoryChanges[]> {
    const changes: RepositoryChanges[] = [];
    
    for (const repoPath of repositories) {
      try {
        // Get repository status
        const status = await getGitStatus(repoPath);
        
        // Get diff based on request parameters
        const diff = await getGitDiff(repoPath, {
          compareToRef: request.compare_to,
          includeStaged: request.include_staged,
          includeUnstaged: request.include_unstaged,
        });
        
        if (!diff.trim()) {
          continue; // No changes in this repo
        }
        
        // Estimate tokens and truncate if needed
        const diffTokens = countTokens(diff);
        let truncatedDiff = diff;
        let truncated = false;
        
        if (diffTokens > MAX_DIFF_TOKENS) {
          // Truncate the diff to fit token limits
          const lines = diff.split('\n');
          const targetLength = Math.floor((MAX_DIFF_TOKENS / diffTokens) * lines.length);
          truncatedDiff = lines.slice(0, targetLength).join('\n') + 
            '\n\n[DIFF TRUNCATED DUE TO SIZE LIMITS]';
          truncated = true;
        }
        
        changes.push({
          repoPath,
          status,
          diff: truncatedDiff,
          diffTokens: countTokens(truncatedDiff),
          truncated,
        });
      } catch (error) {
        logger.warn(`Failed to get changes for repository ${repoPath}:`, error);
      }
    }
    
    return changes;
  }
  
  private async preparePrompt(
    request: PrecommitRequest,
    repoChanges: RepositoryChanges[]
  ): Promise<string> {
    const parts: string[] = [];
    
    // Add user context if provided
    if (request.prompt) {
      parts.push(
        `=== ORIGINAL REQUEST / CONTEXT ===\n${request.prompt}\n=== END CONTEXT ===\n`
      );
    }
    
    // Add focus instruction if provided
    if (request.focus_on) {
      parts.push(
        `=== SPECIFIC FOCUS ===\n${request.focus_on}\n=== END FOCUS ===\n`
      );
    }
    
    // Add git diffs
    parts.push('=== GIT DIFFS ===');
    for (const repo of repoChanges) {
      parts.push(`\n--- Repository: ${repo.repoPath} ---`);
      parts.push(`Branch: ${repo.status.branch}`);
      if (repo.status.ahead > 0 || repo.status.behind > 0) {
        parts.push(`Ahead: ${repo.status.ahead}, Behind: ${repo.status.behind}`);
      }
      if (repo.truncated) {
        parts.push('[NOTE: Diff truncated due to size]');
      }
      parts.push(`\n${repo.diff}`);
    }
    parts.push('\n=== END DIFFS ===');
    
    // Add additional context files if provided
    if (request.files && request.files.length > 0) {
      const fileContents = await this.readFilesSecurely(request.files);
      const formattedFiles = Object.entries(fileContents)
        .map(([path, content]) => `File: ${path}\n${content}`)
        .join('\n\n');
      
      if (formattedFiles) {
        parts.push(
          `\n=== ADDITIONAL CONTEXT FILES ===\n${formattedFiles}\n=== END CONTEXT FILES ===`
        );
      }
    }
    
    // Add review instructions
    const reviewInstructions = this.buildReviewInstructions(request);
    
    // Add web search instruction if enabled
    const websearchInstruction = buildWebSearchInstruction(
      request.use_websearch !== false,
      `When reviewing changes, consider if searches for these would help:
- Security implications of the changes
- Best practices for the patterns being introduced
- Known issues with similar implementations
- Framework-specific guidelines`
    );
    
    return `${reviewInstructions}${websearchInstruction}\n\n${parts.join('\n')}`;
  }
  
  private buildReviewInstructions(request: PrecommitRequest): string {
    const parts: string[] = [];
    
    // Add review type specific instructions
    switch (request.review_type) {
      case 'security':
        parts.push('REVIEW FOCUS: Prioritize security vulnerabilities in the changes.');
        break;
      case 'performance':
        parts.push('REVIEW FOCUS: Prioritize performance impacts of the changes.');
        break;
      case 'quick':
        parts.push('REVIEW FOCUS: Quick review for critical issues only.');
        break;
      default:
        parts.push('REVIEW FOCUS: Comprehensive review of all changes.');
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
    
    return parts.join('\n');
  }
}