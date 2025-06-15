/**
 * TestGen tool - Comprehensive test suite generation
 * 
 * This tool generates comprehensive test suites by analyzing code paths,
 * identifying edge cases, and producing test scaffolding that follows
 * project conventions when test examples are provided.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { 
  TestGenRequest, 
  ToolOutput, 
  ToolModelCategory,
  ThinkingModeSchema,
} from '../types/tools.js';
import { TESTGEN_PROMPT } from '../systemprompts/testgen-prompt.js';
import { 
  TEMPERATURE_ANALYTICAL,
  IS_AUTO_MODE,
} from '../config.js';
import { 
  checkPromptSize, 
  formatClarificationRequest,
  formatTestSampleNeeded,
  formatMoreTestsRequired,
  parseSpecialStatus,
  getThinkingModeDescription,
} from '../utils/tool-helpers.js';
import { logger } from '../utils/logger.js';
import { countTokens } from '../utils/token-utils.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { modelProviderRegistry } from '../providers/registry.js';

/**
 * Request validation schema
 */
const TestGenRequestSchema = z.object({
  files: z.array(z.string()),
  prompt: z.string(),
  model: z.string().optional(),
  test_examples: z.array(z.string()).optional(),
  thinking_mode: ThinkingModeSchema.optional(),
  continuation_id: z.string().optional(),
});

/**
 * Test example information
 */
interface TestExample {
  path: string;
  content: string;
  size: number;
  tokens: number;
}

// Token budget for test examples (25% of typical context)
const TEST_EXAMPLES_TOKEN_BUDGET = 30000;
const MIN_TEST_FILE_SIZE = 100; // bytes
const MAX_TEST_FILE_SIZE = 50000; // bytes

export class TestGenTool extends BaseTool {
  name = 'testgen';
  
  description = 
    'COMPREHENSIVE TEST GENERATION - Creates thorough test suites with edge case coverage. ' +
    'IMPORTANT: This tool MUST be used when explicitly invoked (e.g., "zenode:testgen [files/query]"). ' +
    'Use this when you need to generate tests for code, create test scaffolding, or improve test coverage. ' +
    'BE SPECIFIC about scope: target specific functions/classes/modules rather than testing everything. ' +
    'Examples: \'Generate tests for User.login() method\', \'Test payment processing validation\', ' +
    '\'Create tests for authentication error handling\'. If user request is vague, either ask for ' +
    'clarification about specific components to test, or make focused scope decisions and explain them. ' +
    'Analyzes code paths, identifies realistic failure modes, and generates framework-specific tests. ' +
    'Supports test pattern following when examples are provided. ' +
    'Choose thinking_mode based on code complexity: \'low\' for simple functions, ' +
    '\'medium\' for standard modules (default), \'high\' for complex systems with many interactions, ' +
    '\'max\' for critical systems requiring exhaustive test coverage. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema(): any {
    const schema = {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Code files or directories to generate tests for (must be absolute paths)',
        },
        prompt: {
          type: 'string',
          description: 'Description of what to test, testing objectives, and specific scope/focus areas',
        },
        model: {
          type: 'string',
          description: IS_AUTO_MODE 
            ? this.getModelDescription()
            : `Model to use. Default: ${process.env.DEFAULT_MODEL || 'auto'}`,
        },
        test_examples: {
          type: 'array',
          items: { type: 'string' },
          description: 
            'Optional existing test files or directories to use as style/pattern reference (must be absolute paths). ' +
            'If not provided, the tool will determine the best testing approach based on the code structure. ' +
            'For large test directories, only the smallest representative tests will be included to determine testing patterns. ' +
            'If similar tests exist for the code being tested, include those for the most relevant patterns.',
        },
        thinking_mode: {
          type: 'string',
          enum: ['minimal', 'low', 'medium', 'high', 'max'],
          description: getThinkingModeDescription(),
        },
        continuation_id: {
          type: 'string',
          description: 
            'Thread continuation ID for multi-turn conversations. Can be used to continue conversations ' +
            'across different tools. Only provide this if continuing a previous conversation thread.',
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
    return TESTGEN_PROMPT;
  }
  
  async execute(args: TestGenRequest): Promise<ToolOutput> {
    try {
      // Validate request
      const validatedRequest = TestGenRequestSchema.parse(args);
      logger.debug('TestGen request validated', { 
        files: validatedRequest.files.length,
        hasTestExamples: !!validatedRequest.test_examples?.length,
      });
      
      // Check prompt size
      if (validatedRequest.prompt) {
        const sizeCheck = checkPromptSize(validatedRequest.prompt, 'prompt');
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
        this.defaultTemperature,
        false, // TestGen doesn't use web search
        conversationContext,
      );
      
      // Get provider and make actual API call
      const provider = await modelProviderRegistry.getProviderForModel(model);
      if (!provider) {
        throw new Error(`No provider available for model: ${model}`);
      }
      
      logger.info('Executing test generation', { model });
      
      // Generate response from AI
      const response = await provider.generateResponse(modelRequest);
      
      // Check if response contains special status
      const specialStatus = parseSpecialStatus(response.content);
      if (specialStatus) {
        // Handle special statuses appropriately
        logger.info('TestGen returned special status:', specialStatus);
      }
      
      // Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validatedRequest.prompt,
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validatedRequest.continuation_id,
      );
      
      return this.formatOutput(
        response.content,
        'success',
        'code',
        {
          model_used: response.modelName,
          token_usage: response.usage,
        },
        continuationOffer,
      );
      
    } catch (error) {
      logger.error('TestGen execution error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request parameters: ${error.errors.map(e => e.message).join(', ')}`,
          'error',
          'text',
        );
      }
      
      return this.formatOutput(
        `Error during test generation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
        'text',
      );
    }
  }
  
  private async preparePrompt(request: TestGenRequest): Promise<string> {
    const parts: string[] = [];
    
    // Add testing objectives
    parts.push(
      `=== TESTING OBJECTIVES ===\n${request.prompt}\n=== END OBJECTIVES ===\n`
    );
    
    // Add code files to test
    const codeContents = await this.readFilesSecurely(request.files);
    const formattedCode = Object.entries(codeContents)
      .map(([filePath, content]) => `=== CODE FILE: ${filePath} ===\n${content}\n=== END FILE ===`)
      .join('\n\n');
    
    parts.push(`=== CODE TO TEST ===\n${formattedCode}\n=== END CODE ===`);
    
    // Process test examples if provided
    if (request.test_examples && request.test_examples.length > 0) {
      const { content, summary } = await this.processTestExamples(
        request.test_examples,
        request.continuation_id
      );
      
      if (content) {
        parts.push(`\n=== TEST EXAMPLES FOR PATTERN REFERENCE ===\n${content}\n=== END EXAMPLES ===`);
        if (summary) {
          parts.push(`\n${summary}`);
        }
      }
    }
    
    return parts.join('\n');
  }
  
  private async processTestExamples(
    testExamplePaths: string[],
    continuationId?: string
  ): Promise<{ content: string; summary: string }> {
    logger.debug(`Processing ${testExamplePaths.length} test examples`);
    
    const examples: TestExample[] = [];
    let totalTokens = 0;
    
    // Collect test examples with size and token info
    for (const examplePath of testExamplePaths) {
      try {
        const stat = await fs.stat(examplePath);
        
        if (stat.isDirectory()) {
          // Find test files in directory
          const testFiles = await this.findTestFiles(examplePath);
          for (const testFile of testFiles) {
            const example = await this.loadTestExample(testFile);
            if (example) {
              examples.push(example);
            }
          }
        } else if (stat.isFile()) {
          const example = await this.loadTestExample(examplePath);
          if (example) {
            examples.push(example);
          }
        }
      } catch (error) {
        logger.warn(`Failed to process test example ${examplePath}:`, error);
      }
    }
    
    if (examples.length === 0) {
      return { content: '', summary: '' };
    }
    
    // Sort by size (prefer smaller, more focused tests)
    examples.sort((a, b) => a.size - b.size);
    
    // Select examples within token budget
    const selectedExamples: TestExample[] = [];
    for (const example of examples) {
      if (totalTokens + example.tokens <= TEST_EXAMPLES_TOKEN_BUDGET) {
        selectedExamples.push(example);
        totalTokens += example.tokens;
      } else {
        break; // Token budget exceeded
      }
    }
    
    logger.info(`Selected ${selectedExamples.length} of ${examples.length} test examples (${totalTokens} tokens)`);
    
    // Format selected examples
    const content = selectedExamples
      .map(ex => `--- Test Example: ${ex.path} ---\n${ex.content}`)
      .join('\n\n');
    
    const summary = examples.length > selectedExamples.length
      ? `[NOTE: Showing ${selectedExamples.length} of ${examples.length} test examples due to size constraints]`
      : '';
    
    return { content, summary };
  }
  
  private async loadTestExample(filePath: string): Promise<TestExample | null> {
    try {
      const stat = await fs.stat(filePath);
      
      // Skip files that are too small or too large
      if (stat.size < MIN_TEST_FILE_SIZE || stat.size > MAX_TEST_FILE_SIZE) {
        return null;
      }
      
      const content = await fs.readFile(filePath, 'utf-8');
      const tokens = countTokens(content);
      
      return {
        path: filePath,
        content,
        size: stat.size,
        tokens,
      };
    } catch (error) {
      logger.warn(`Failed to load test example ${filePath}:`, error);
      return null;
    }
  }
  
  private async findTestFiles(dirPath: string, maxDepth: number = 2): Promise<string[]> {
    const testFiles: string[] = [];
    
    async function searchDir(dir: string, depth: number): Promise<void> {
      if (depth > maxDepth) return;
      
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await searchDir(fullPath, depth + 1);
          } else if (entry.isFile() && isTestFile(entry.name)) {
            testFiles.push(fullPath);
          }
        }
      } catch (error) {
        logger.warn(`Failed to search directory ${dir}:`, error);
      }
    }
    
    function isTestFile(filename: string): boolean {
      const testPatterns = [
        /\.test\.[jt]sx?$/,
        /\.spec\.[jt]sx?$/,
        /_test\.[jt]sx?$/,
        /test_.*\.py$/,
        /.*_test\.py$/,
        /Test.*\.java$/,
        /.*Test\.java$/,
        /test_.*\.go$/,
        /.*_test\.go$/,
        /.*Tests?\.(cs|swift|m)$/,
      ];
      
      return testPatterns.some(pattern => pattern.test(filename));
    }
    
    await searchDir(dirPath, 0);
    return testFiles;
  }
}