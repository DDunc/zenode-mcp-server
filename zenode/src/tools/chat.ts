/**
 * Chat Tool - General development conversations and brainstorming
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolOutput, ChatRequest } from '../types/tools.js';
import { BaseToolRequestSchema } from '../utils/schema-helpers.js';
import { modelProviderRegistry } from '../providers/registry.js';
import { TEMPERATURE_BALANCED } from '../config.js';
import { logger } from '../utils/logger.js';
import { shouldShowBootstrapGuidance, getBootstrapWelcome } from '../utils/auto-bootstrap.js';

/**
 * Chat tool request schema
 */
const ChatRequestSchema = BaseToolRequestSchema.extend({
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
    'SPECIAL SHORTHAND: If a message starts with ":z" it calls zenode:chat to coordinate with 3 other zenode tools (4 total). ' +
    'When coordinating, if unsure which tools to involve, default to: analyze, thinkdeep, and debug. ' +
    'Use this when you need to ask questions, brainstorm ideas, get opinions, discuss topics, ' +
    'share your thinking, or need explanations about concepts and approaches. ' +
    'Perfect for: bouncing ideas, getting second opinions, collaborative brainstorming, validating approaches, exploring alternatives. ' +
    'Note: If you\'re not currently using a top-tier model such as Opus 4 or above, these tools can provide enhanced capabilities.';
  
  defaultTemperature = TEMPERATURE_BALANCED;
  modelCategory = 'all' as const;

  getZodSchema() {
    return ChatRequestSchema;
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
    const startTime = Date.now();
    const requestId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate request
      const validated = ChatRequestSchema.parse(args);
      
      logger.info(`Chat tool invoked with prompt length: ${validated.prompt.length}`);
      
      // Log the request (Redis-based conversation logger)
      await this.logToolRequest(requestId, validated, validated.continuation_id);
      
      // Check if this might be a first-time user who needs bootstrap guidance
      const bootstrapCheck = shouldShowBootstrapGuidance();
      if (bootstrapCheck.show) {
        logger.info(`First-time user detected: ${bootstrapCheck.reason} - Auto-triggering setup`);
        
        // Auto-trigger bootstrap setup for first-time users
        try {
          const { BootstrapTool } = await import('./bootstrap.js');
          const bootstrapTool = new BootstrapTool();
          
          const bootstrapResult = await bootstrapTool.execute({ 
            action: 'auto-setup', 
            skip_prompts: true,
            auto_restart: true 
          });
          
          // After bootstrap, continue with the original chat request
          if (bootstrapResult.status === 'success') {
            logger.info('Bootstrap completed successfully, continuing with chat');
            // Continue with the chat execution below (don't return here)
          } else {
            // Bootstrap failed, show error and manual instructions
            return this.formatOutput(`❌ **Auto-setup encountered an issue:**

${bootstrapResult.content}

**Your original question:** "${validated.prompt}"

**Manual setup:** Try running \`:z bootstrap auto-setup\` manually`, 'error');
          }
        } catch (error) {
          logger.error('Bootstrap auto-setup error:', error);
          const welcome = getBootstrapWelcome();
          return this.formatOutput(
            `${welcome}\n\n**Your Question:** "${validated.prompt}"\n\n*Auto-setup failed. Please run the bootstrap command manually.*`,
            'error'
          );
        }
      }
      
      // Check prompt size
      this.checkPromptSize(validated.prompt);
      
      // Validate images if provided
      if (validated.images && validated.images.length > 0) {
        const imageValidation = await this.validateImageLimits(validated.images, validated.model || 'auto');
        if (imageValidation) {
          return imageValidation; // Return error if image validation fails
        }
      }
      
      // Select model (with automatic vision model selection if images present)
      const selectedModel = await this.selectModel(validated.model, undefined, !!validated.images?.length);
      const provider = await modelProviderRegistry.getProviderForModel(selectedModel);
      
      if (!provider) {
        throw new Error(`No provider available for model: ${selectedModel}`);
      }
      
      // Auto-detect files mentioned in the prompt
      const autoDetectedFiles = await this.autoReadFilesFromPrompt(validated.prompt);
      
      // Combine explicitly provided files with auto-detected ones
      const allFiles = { ...autoDetectedFiles };
      if (validated.files && validated.files.length > 0) {
        logger.info(`Reading ${validated.files.length} explicitly provided files for context`);
        const explicitFiles = await this.readFilesSecurely(validated.files);
        Object.assign(allFiles, explicitFiles);
      }
      
      // Build file context
      let fileContext = '';
      if (Object.keys(allFiles).length > 0) {
        logger.info(`Including ${Object.keys(allFiles).length} files in context`);
        fileContext = '\n\nFile contents for reference:\n';
        for (const [filePath, content] of Object.entries(allFiles)) {
          fileContext += `\n--- ${filePath} ---\n${content}\n`;
        }
      }
      
      // Extract conversation context if continuing
      const conversationContext = (args as any)._conversation_context;
      
      // Apply smart context injection
      const contextResult = await this.injectSmartContext(validated);
      const contextEnhancedArgs = contextResult.enhancedArgs;
      const contextInfo = contextResult.contextInfo;
      
      // Create full prompt (use enhanced prompt if context was injected)
      const fullPrompt = (contextEnhancedArgs.prompt || validated.prompt) + fileContext;
      
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
      
      // Handle conversation threading with file tracking
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validated.prompt,
        response.content,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        validated.continuation_id,
        validated.files, // Track files provided by user
        validated.files, // Same files were processed by tool
      );
      
      // Add context suggestion to response if context was found
      const contextSuggestion = this.formatContextSuggestion(contextInfo);
      const enhancedContent = response.content + contextSuggestion;
      
      // Format output
      const result = this.formatOutput(
        enhancedContent,
        'success',
        'text',
        {
          model_used: response.modelName,
          token_usage: response.usage,
          context_applied: contextInfo?.injected || false,
          related_threads_found: contextInfo?.threadsFound?.length || 0,
        },
        continuationOffer,
      );
      
      // Log the successful response (Redis-based conversation logger)
      const duration = Date.now() - startTime;
      await this.logToolResponse(requestId, result, undefined, duration, validated.continuation_id);
      
      return result;
      
    } catch (error) {
      logger.error('Chat tool error:', error);
      
      // Log the error response (Redis-based conversation logger)
      const duration = Date.now() - startTime;
      const errorResult = error instanceof z.ZodError
        ? this.formatOutput(
            `Invalid request: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
            'error',
          )
        : this.formatOutput(
            `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
}