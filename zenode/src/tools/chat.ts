/**
 * Chat Tool - General development conversations and brainstorming
 */

import { z } from 'zod';
import { BaseTool, BaseRequestSchema } from './base.js';
import { ToolOutput, ChatRequest } from '../types/tools.js';
import { modelProviderRegistry } from '../providers/registry.js';
import { TEMPERATURE_BALANCED } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Chat tool request schema
 */
const ChatRequestSchema = BaseRequestSchema.extend({
  prompt: z.string().describe('Your question, topic, or current thinking to discuss'),
  files: z.array(z.string()).optional().describe('Optional files for context (must be absolute paths)'),
});

/**
 * Chat tool implementation
 */
export class ChatTool extends BaseTool {
  name = 'chat';
  description = 
    'GENERAL CHAT & COLLABORATIVE THINKING - AI thinking partner for development discussions. ' +
    'IMPORTANT: This tool MUST be used when explicitly invoked (e.g., "zenode:chat [your question]"). ' +
    'SPECIAL SHORTHAND: If a message starts with "z:" it calls zenode:chat to coordinate with 3 other zenode tools (4 total). ' +
    'When coordinating, if unsure which tools to involve, default to: analyze, thinkdeep, and debug. ' +
    'Use this when you need to ask questions, brainstorm ideas, get opinions, discuss topics, ' +
    'share your thinking, or need explanations about concepts and approaches. ' +
    'Perfect for: bouncing ideas, getting second opinions, collaborative brainstorming, validating approaches, exploring alternatives. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_BALANCED;
  modelCategory = 'all' as const;

  getInputSchema() {
    return {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Your question, topic, or current thinking to discuss',
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional files for context (must be absolute paths)',
        },
        model: {
          type: 'string',
          description: this.getModelDescription(),
        },
        temperature: {
          type: 'number',
          description: `Response creativity (0-1, default ${this.defaultTemperature})`,
        },
        use_websearch: {
          type: 'boolean',
          description: 'Enable web search for documentation, best practices, and current information',
          default: true,
        },
        continuation_id: {
          type: 'string',
          description: 'Thread continuation ID for multi-turn conversations',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    };
  }

  getSystemPrompt(): string {
    return `You are an AI assistant helping with software development tasks through natural conversation.

Your role is to:
- Engage in thoughtful discussions about technical topics
- Help brainstorm solutions and explore ideas
- Provide clear explanations of concepts
- Offer second opinions and alternative perspectives
- Validate approaches and identify potential issues

Guidelines:
- Be conversational but stay focused on being helpful
- Ask clarifying questions when needed
- Provide examples and analogies to explain complex concepts
- Suggest resources or next steps when appropriate
- Be honest about limitations or uncertainties

Remember: You're a thinking partner, not just an answer machine. Engage with the developer's ideas and help them think through problems.`;
  }

  async execute(args: ChatRequest): Promise<ToolOutput> {
    try {
      // Validate request
      const validated = ChatRequestSchema.parse(args);
      
      logger.info(`Chat tool invoked with prompt length: ${validated.prompt.length}`);
      
      // Check prompt size
      this.checkPromptSize(validated.prompt);
      
      // Select model
      const selectedModel = await this.selectModel(validated.model);
      const provider = await modelProviderRegistry.getProviderForModel(selectedModel);
      
      if (!provider) {
        throw new Error(`No provider available for model: ${selectedModel}`);
      }
      
      // Read files if provided
      let fileContext = '';
      if (validated.files && validated.files.length > 0) {
        logger.info(`Reading ${validated.files.length} files for context`);
        const fileContents = await this.readFilesSecurely(validated.files);
        
        fileContext = '\n\nFile contents for reference:\n';
        for (const [filePath, content] of Object.entries(fileContents)) {
          fileContext += `\n--- ${filePath} ---\n${content}\n`;
        }
      }
      
      // Extract conversation context if continuing
      const conversationContext = (args as any)._conversation_context;
      
      // Create full prompt
      const fullPrompt = validated.prompt + fileContext;
      
      // Create model request
      const modelRequest = await this.createModelRequest(
        fullPrompt,
        this.getSystemPrompt(),
        selectedModel,
        validated.temperature ?? this.defaultTemperature,
        validated.use_websearch,
        conversationContext,
      );
      
      // Generate response
      logger.info(`Generating chat response with model: ${selectedModel}`);
      const response = await provider.generateResponse(modelRequest);
      
      // Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validated.prompt,
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validated.continuation_id,
      );
      
      // Format output
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
      logger.error('Chat tool error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          'error',
        );
      }
      
      return this.formatOutput(
        `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    }
  }
}