/**
 * Refactor tool - Intelligent code refactoring suggestions with precise line-number references
 *
 * This tool analyzes code for refactoring opportunities across four main categories:
 * - codesmells: Detect and suggest fixes for common code smells
 * - decompose: Break down large functions, classes, and modules into smaller, focused components
 * - modernize: Update code to use modern language features and patterns
 * - organization: Suggest better organization and logical grouping of related functionality
 *
 * Key Features:
 * - Cross-language support with language-specific guidance
 * - Precise line-number references for Claude
 * - Large context handling with token budgeting
 * - Structured JSON responses for easy parsing
 * - Style guide integration for project-specific patterns
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { REFACTOR_PROMPT } from '../systemprompts/refactor-prompt.js';
import { ToolModelCategory, ToolOutput } from '../types/tools.js';
import { BaseToolRequestSchema } from '../utils/schema-helpers.js';
import { modelProviderRegistry } from '../providers/registry.js';
import * as path from 'path';
import { logger } from '../utils/logger.js';

// Field descriptions to avoid duplication between Zod and JSON schema
const REFACTOR_FIELD_DESCRIPTIONS = {
  files: "Code files or directories to analyze for refactoring opportunities. MUST be FULL absolute paths to real files / folders - DO NOT SHORTEN. The files also MUST directly involve the classes, functions etc that need to be refactored. Closely related or dependent files will also help.",
  prompt: "Description of refactoring goals, context, and specific areas of focus.",
  refactor_type: "Type of refactoring analysis to perform",
  focus_areas: "Specific areas to focus on (e.g., 'performance', 'readability', 'maintainability', 'security')",
  style_guide_examples: "Optional existing code files to use as style/pattern reference (must be FULL absolute paths to real files / folders - DO NOT SHORTEN). These files represent the target coding style and patterns for the project."
};

// Zod schema for request validation
const RefactorRequestSchema = BaseToolRequestSchema.extend({
  files: z.array(z.string()).describe(REFACTOR_FIELD_DESCRIPTIONS.files),
  prompt: z.string().describe(REFACTOR_FIELD_DESCRIPTIONS.prompt),
  refactor_type: z.enum(['codesmells', 'decompose', 'modernize', 'organization']).describe(REFACTOR_FIELD_DESCRIPTIONS.refactor_type),
  focus_areas: z.array(z.string()).optional().describe(REFACTOR_FIELD_DESCRIPTIONS.focus_areas),
  style_guide_examples: z.array(z.string()).optional().describe(REFACTOR_FIELD_DESCRIPTIONS.style_guide_examples),
});

type RefactorRequest = z.infer<typeof RefactorRequestSchema>;

export class RefactorTool extends BaseTool {
  name = 'refactor';
  description = `INTELLIGENT CODE REFACTORING - Analyzes code for refactoring opportunities with precise line-number guidance. Supports four refactor types: 'codesmells' (detect anti-patterns), 'decompose' (break down large functions/classes/modules into smaller components), 'modernize' (update to modern language features), and 'organization' (improve organization and grouping of related functionality). Provides specific, actionable refactoring steps that Claude can implement directly. Choose thinking_mode based on codebase complexity: 'medium' for standard modules (default), 'high' for complex systems, 'max' for legacy codebases requiring deep analysis. Note: If you're not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.`;

  defaultTemperature = 0.2; // Analytical accuracy
  modelCategory = ToolModelCategory.EXTENDED_REASONING;

  getZodSchema() {
    return RefactorRequestSchema;
  }

  getSystemPrompt(): string {
    return REFACTOR_PROMPT;
  }

  /**
   * Detect the primary programming language from file extensions.
   */
  private detectPrimaryLanguage(filePaths: string[]): string {
    const languageExtensions: Record<string, Set<string>> = {
      python: new Set(['.py']),
      javascript: new Set(['.js', '.jsx', '.mjs']),
      typescript: new Set(['.ts', '.tsx']),
      java: new Set(['.java']),
      csharp: new Set(['.cs']),
      cpp: new Set(['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp']),
      go: new Set(['.go']),
      rust: new Set(['.rs']),
      swift: new Set(['.swift']),
      kotlin: new Set(['.kt']),
      ruby: new Set(['.rb']),
      php: new Set(['.php']),
      scala: new Set(['.scala']),
    };

    // Count files by language
    const languageCounts: Record<string, number> = {};
    for (const filePath of filePaths) {
      const extension = path.extname(filePath.toLowerCase());
      for (const [lang, exts] of Object.entries(languageExtensions)) {
        if (exts.has(extension)) {
          languageCounts[lang] = (languageCounts[lang] || 0) + 1;
          break;
        }
      }
    }

    if (Object.keys(languageCounts).length === 0) {
      return 'unknown';
    }

    // Return most common language, or "mixed" if multiple languages
    const maxCount = Math.max(...Object.values(languageCounts));
    const dominantLanguages = Object.keys(languageCounts).filter(
      (lang) => languageCounts[lang] === maxCount
    );

    return dominantLanguages.length === 1 ? dominantLanguages[0]! : 'mixed';
  }

  /**
   * Generate language-specific guidance for the refactoring prompt.
   */
  private getLanguageSpecificGuidance(language: string, refactorType: string): string {
    if (language === 'unknown' || language === 'mixed') {
      return '';
    }

    // Language-specific modernization features
    const modernizationFeatures: Record<string, string> = {
      python: 'f-strings, dataclasses, type hints, pathlib, async/await, context managers, list/dict comprehensions, walrus operator',
      javascript: 'async/await, destructuring, arrow functions, template literals, optional chaining, nullish coalescing, modules (import/export)',
      typescript: 'strict type checking, utility types, const assertions, template literal types, mapped types',
      java: 'streams API, lambda expressions, optional, records, pattern matching, var declarations, text blocks',
      csharp: 'LINQ, nullable reference types, pattern matching, records, async streams, using declarations',
      swift: 'value types, protocol-oriented programming, property wrappers, result builders, async/await',
      go: 'modules, error wrapping, context package, generics (Go 1.18+)',
      rust: 'ownership patterns, iterator adapters, error handling with Result, async/await',
    };

    // Language-specific code splitting patterns
    const splittingPatterns: Record<string, string> = {
      python: 'modules, classes, functions, decorators for cross-cutting concerns',
      javascript: 'modules (ES6), classes, functions, higher-order functions',
      java: 'packages, classes, interfaces, abstract classes, composition over inheritance',
      csharp: 'namespaces, classes, interfaces, extension methods, dependency injection',
      swift: 'extensions, protocols, structs, enums with associated values',
      go: 'packages, interfaces, struct composition, function types',
    };

    const guidanceParts: string[] = [];

    if (refactorType === 'modernize' && modernizationFeatures[language]) {
      guidanceParts.push(
        `LANGUAGE-SPECIFIC MODERNIZATION (${language.toUpperCase()}): Focus on ${modernizationFeatures[language]}`
      );
    }

    if (refactorType === 'decompose' && splittingPatterns[language]) {
      guidanceParts.push(
        `LANGUAGE-SPECIFIC DECOMPOSITION (${language.toUpperCase()}): Use ${splittingPatterns[language]} to break down large components`
      );
    }

    // General language guidance
    const generalGuidance: Record<string, string> = {
      python: 'Follow PEP 8, use descriptive names, prefer composition over inheritance',
      javascript: 'Use consistent naming conventions, avoid global variables, prefer functional patterns',
      java: 'Follow Java naming conventions, use interfaces for abstraction, consider immutability',
      csharp: 'Follow C# naming conventions, use nullable reference types, prefer async methods',
    };

    if (generalGuidance[language]) {
      guidanceParts.push(`GENERAL GUIDANCE (${language.toUpperCase()}): ${generalGuidance[language]}`);
    }

    return guidanceParts.join('\n');
  }

  async execute(args: RefactorRequest): Promise<ToolOutput> {
    const startTime = Date.now();
    const requestId = `refactor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const request = RefactorRequestSchema.parse(args);
      
      logger.info(`[REFACTOR] Execute called with ${request.files.length} files, type=${request.refactor_type}`);
      
      // Log the request (Redis-based conversation logger)
      await this.logToolRequest(requestId, request, request.continuation_id);
      
      // Check prompt size
      this.checkPromptSize(request.prompt);
      
      // Read the requested files
      const fileContents = await this.readFilesSecurely(request.files);
      
      // Read style guide examples if provided
      let styleExamplesContent = '';
      if (request.style_guide_examples && request.style_guide_examples.length > 0) {
        try {
          const styleFiles = await this.readFilesSecurely(request.style_guide_examples);
          styleExamplesContent = Object.entries(styleFiles)
            .map(([path, content]) => `File: ${path}\n${content}`)
            .join('\n\n');
        } catch (error) {
          logger.warning(`[REFACTOR] Failed to read style guide examples: ${error}`);
        }
      }

      // Detect primary language for language-specific guidance
      const primaryLanguage = this.detectPrimaryLanguage(request.files);
      logger.debug(`[REFACTOR] Detected primary language: ${primaryLanguage}`);

      // Get language-specific guidance
      const languageGuidance = this.getLanguageSpecificGuidance(primaryLanguage, request.refactor_type);

      // Build the complete prompt
      const promptParts: string[] = [];

      // Add user context
      promptParts.push('=== USER CONTEXT ===');
      promptParts.push(`Refactor Type: ${request.refactor_type}`);
      if (request.focus_areas) {
        promptParts.push(`Focus Areas: ${request.focus_areas.join(', ')}`);
      }
      promptParts.push(`User Goals: ${request.prompt}`);
      promptParts.push('=== END CONTEXT ===');

      // Add style guide examples if provided
      if (styleExamplesContent) {
        promptParts.push('\n=== STYLE GUIDE EXAMPLES ===');
        promptParts.push(styleExamplesContent);
        promptParts.push('=== END STYLE GUIDE EXAMPLES ===');
      }

      // Add main code to analyze
      promptParts.push('\n=== CODE TO ANALYZE ===');
      const codeContent = Object.entries(fileContents)
        .map(([filePath, content]) => {
          const lines = content.split('\n');
          const numberedLines = lines.map((line, index) => `${(index + 1).toString().padStart(4, ' ')}│ ${line}`);
          return `File: ${filePath}\n${numberedLines.join('\n')}`;
        })
        .join('\n\n');
      promptParts.push(codeContent);
      promptParts.push('=== END CODE ===');

      // Add generation instructions
      promptParts.push(
        `\nPlease analyze the code for ${request.refactor_type} refactoring opportunities following the multi-expert workflow specified in the system prompt.`
      );
      if (styleExamplesContent) {
        promptParts.push(
          'Use the provided style guide examples as a reference for target coding patterns and style.'
        );
      }

      const fullPrompt = promptParts.join('\n');

      // Log final prompt statistics
      logger.info(`[REFACTOR] Complete prompt prepared: ${fullPrompt.length.toLocaleString()} characters`);

      // Select model
      const selectedModel = await this.selectModel(request.model);
      const provider = await modelProviderRegistry.getProviderForModel(selectedModel);
      
      if (!provider) {
        throw new Error(`No provider available for model: ${selectedModel}`);
      }
      
      // Build enhanced system prompt with language guidance
      const baseSystemPrompt = this.getSystemPrompt();
      const enhancedSystemPrompt = languageGuidance
        ? `${baseSystemPrompt}\n\n${languageGuidance}`
        : baseSystemPrompt;
      
      // Extract conversation context if continuing
      const conversationContext = (args as any)._conversation_context;
      
      // Create model request
      const modelRequest = await this.createModelRequest(
        fullPrompt,
        enhancedSystemPrompt,
        selectedModel,
        request.temperature ?? this.defaultTemperature,
        request.use_websearch,
        conversationContext,
      );
      
      // Generate response
      logger.info(`[REFACTOR] Generating refactor analysis with model: ${selectedModel}`);
      const response = await provider.generateResponse(modelRequest);
      
      // Handle conversation threading with file tracking
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        request.prompt,
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        request.continuation_id,
        request.files, // Track files provided by user
        request.files, // Same files were processed by tool
      );
      
      // Format the response with implementation directives
      const formattedResponse = this.formatRefactorResponse(response.content, request);
      
      // Format output
      const result = this.formatOutput(
        formattedResponse,
        'success',
        'text',
        {
          model_used: response.modelName,
          token_usage: response.usage,
        },
        continuationOffer,
      );
      
      // Log the successful response (Redis-based conversation logger)
      const duration = Date.now() - startTime;
      await this.logToolResponse(requestId, result, undefined, duration, request.continuation_id);
      
      return result;
    
    } catch (error) {
      logger.error('[REFACTOR] Tool error:', error);
      
      // Log the error response (Redis-based conversation logger)
      const duration = Date.now() - startTime;
      const errorResult = error instanceof z.ZodError
        ? this.formatOutput(
            `Invalid request: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
            'error',
          )
        : this.formatOutput(
            `Refactor analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'error',
          );
      
      await this.logToolResponse(
        requestId, 
        errorResult, 
        error instanceof Error ? error : new Error(String(error)), 
        duration,
        (args as any)?.continuation_id
      );
      
      return errorResult;
    }
  }

  /**
   * Format the refactoring response with immediate implementation directives.
   */
  private formatRefactorResponse(response: string, request: RefactorRequest): string {
    logger.debug(`[REFACTOR] Formatting response for ${request.refactor_type} refactoring`);

    // Return response + steps
    return `${response}

---

MANDATORY NEXT STEPS:

Start executing the refactoring plan immediately:
1. INFORM USER by displaying a brief summary of required refactorings
2. CREATE A CHECKLIST of each refactoring to keep a record of what is to change, how and why
3. IMPLEMENT each refactoring opportunity immediately - think carefully about each change as you implement
4. CREATE new files as needed where decomposition is suggested
5. MODIFY existing files to apply improvements as needed
6. UPDATE all imports, references, and dependencies as needed
7. VERIFY each change works before moving to the next

After each refactoring is implemented:
Show: \`IMPLEMENTED: [brief description] - Files: [list]\` to the user

IMPORTANT:
- DO NOT SKIP any refactorings - implement them all one after another
- VALIDATE each change doesn't break functionality
- UPDATE any imports and references properly and think and search for any other reference that may need updating
- TEST if possible to ensure changes work where tests are available

MANDATORY: MUST start executing the refactor plan and follow each step listed above`;
  }
}