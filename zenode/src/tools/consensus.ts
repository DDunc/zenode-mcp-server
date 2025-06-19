/**
 * Consensus Tool - Multi-model perspective gathering with stance assignment
 * 
 * This tool orchestrates multiple AI models to provide diverse perspectives on technical
 * proposals, plans, and ideas. Each model can be assigned a specific stance (for/against/neutral)
 * with custom instructions to guide their analysis approach.
 * 
 * Key Features:
 * - Multi-model orchestration with stance assignment
 * - Sequential execution for consistent error handling  
 * - Model combination validation with instance limits
 * - Sophisticated stance-specific prompt templates
 * - Structured consensus output with synthesis guidance
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolOutput } from '../types/tools.js';
import { 
  ConsensusRequest, 
  ConsensusRequestSchema,
  ConsensusResponse,
  ModelConfig,
  NormalizedModelConfig,
  ModelResponse,
  ModelValidationResult,
  ConsensusStance,
  SUPPORTIVE_STANCES,
  CRITICAL_STANCES,
  NEUTRAL_STANCES,
  CONSENSUS_FIELD_DESCRIPTIONS,
} from '../types/consensus.js';
import { 
  CONSENSUS_PROMPT,
  getStanceEnhancedPrompt,
} from '../systemprompts/consensus-prompt.js';
import { modelProviderRegistry } from '../providers/registry.js';
import { 
  TEMPERATURE_CONSENSUS, 
  DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION 
} from '../config.js';
import { logger } from '../utils/logger.js';
import { addTurn, getThread, buildConversationHistory } from '../utils/conversation-memory.js';
import { ModelContext } from '../utils/model-context.js';
import { 
  readFile, 
  estimateFileTokens, 
  checkTotalFileSize 
} from '../utils/file-utils.js';

export class ConsensusTool extends BaseTool {
  name = 'consensus';
  description = 
    'MULTI-MODEL CONSENSUS - Gather diverse perspectives from multiple AI models on technical proposals, ' +
    'plans, and ideas. Perfect for validation, feasibility assessment, and getting comprehensive ' +
    'viewpoints on complex decisions. Supports advanced stance steering with custom instructions for each model. ' +
    'You can specify different stances (for/against/neutral) and provide custom stance prompts to guide each ' +
    'model\'s analysis. Example: [{"model": "o3", "stance": "for", "stance_prompt": "Focus on implementation ' +
    'benefits and user value"}, {"model": "flash", "stance": "against", "stance_prompt": "Identify potential ' +
    'risks and technical challenges"}]. Use neutral stances by default unless structured debate would add value.';

  defaultTemperature = TEMPERATURE_CONSENSUS;
  modelCategory = 'extended_reasoning' as const;

  // Properties for base class integration (matching Python patterns)
  private _currentArguments?: any;
  private _modelContext?: ModelContext;
  private _actuallyProcessedFiles?: string[];

  getZodSchema() {
    return ConsensusRequestSchema;
  }

  getSystemPrompt(): string {
    return CONSENSUS_PROMPT;
  }

  getInputSchema(): object {
    return {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: CONSENSUS_FIELD_DESCRIPTIONS.prompt,
        },
        models: {
          type: "array",
          items: {
            type: "object",
            properties: {
              model: {
                type: "string",
                description: CONSENSUS_FIELD_DESCRIPTIONS.model_config_model,
              },
              stance: {
                type: "string",
                enum: ["for", "support", "favor", "against", "oppose", "critical", "neutral"],
                description: CONSENSUS_FIELD_DESCRIPTIONS.model_config_stance,
                default: "neutral",
              },
              stance_prompt: {
                type: "string",
                description: CONSENSUS_FIELD_DESCRIPTIONS.model_config_stance_prompt,
              },
            },
            required: ["model"],
          },
          description: CONSENSUS_FIELD_DESCRIPTIONS.models,
        },
        files: {
          type: "array",
          items: { type: "string" },
          description: CONSENSUS_FIELD_DESCRIPTIONS.files,
        },
        images: {
          type: "array",
          items: { type: "string" },
          description: CONSENSUS_FIELD_DESCRIPTIONS.images,
        },
        focus_areas: {
          type: "array",
          items: { type: "string" },
          description: CONSENSUS_FIELD_DESCRIPTIONS.focus_areas,
        },
        temperature: {
          type: "number",
          description: "Temperature (0-1, default 0.2 for consistency)",
          minimum: 0,
          maximum: 1,
          default: this.defaultTemperature,
        },
        thinking_mode: {
          type: "string",
          enum: ["minimal", "low", "medium", "high", "max"],
          description: "Thinking depth: minimal (0.5% of model max), low (8%), medium (33%), high (67%), max (100% of model max)",
        },
        use_websearch: {
          type: "boolean",
          description: "Enable web search for documentation, best practices, and current information",
          default: true,
        },
        continuation_id: {
          type: "string",
          description: "Thread continuation ID for multi-turn conversations",
        },
      },
      required: ["prompt", "models"],
    };
  }

  /**
   * Format consensus turns with individual model responses for better readability.
   * 
   * This custom formatting shows the individual model responses that were
   * synthesized into the consensus, making it easier to understand the
   * reasoning behind the final recommendation.
   */
  formatConversationTurn(turn: any): string[] {
    const parts: string[] = [];

    // Add files context if present
    if (turn.files && turn.files.length > 0) {
      parts.push(`Files used in this turn: ${turn.files.join(', ')}`);
      parts.push('');
    }

    // Check if this is a consensus turn with individual responses
    if (turn.metadata && turn.metadata.individual_responses) {
      const individualResponses = turn.metadata.individual_responses;

      // Add consensus header
      const modelsConsulted: string[] = [];
      for (const resp of individualResponses) {
        const model = resp.model;
        const stance = resp.stance || 'neutral';
        if (stance !== 'neutral') {
          modelsConsulted.push(`${model}:${stance}`);
        } else {
          modelsConsulted.push(model);
        }
      }

      parts.push(`Models consulted: ${modelsConsulted.join(', ')}`);
      parts.push('');
      parts.push('=== INDIVIDUAL MODEL RESPONSES ===');
      parts.push('');

      // Add each successful model response
      for (let i = 0; i < individualResponses.length; i++) {
        const response = individualResponses[i];
        const modelName = response.model;
        const stance = response.stance || 'neutral';
        const verdict = response.verdict;

        const stanceLabel = stance !== 'neutral' ? 
          `(${stance.charAt(0).toUpperCase() + stance.slice(1)} Stance)` : 
          '(Neutral Analysis)';
        
        parts.push(`**${modelName.toUpperCase()} ${stanceLabel}**:`);
        parts.push(verdict);

        if (i < individualResponses.length - 1) {
          parts.push('');
          parts.push('---');
        }
        parts.push('');
      }

      parts.push('=== END INDIVIDUAL RESPONSES ===');
      parts.push('');
      parts.push("Claude's Synthesis:");
    }

    // Add the actual content
    parts.push(turn.content);

    return parts;
  }

  /**
   * Execute consensus gathering from multiple models
   */
  async execute(args: Record<string, any>): Promise<ToolOutput> {
    const startTime = Date.now();
    const requestId = `consensus-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Store arguments for base class methods (matching Python pattern)
      this._currentArguments = args;

      // Validate request
      const validated = this.validateArgs<ConsensusRequest>(args);
      
      logger.info(`Consensus tool invoked with ${validated.models.length} model configurations`);
      
      // Log the request (Redis-based conversation logger)
      await this.logToolRequest(requestId, validated, validated.continuation_id);

      // Validate model configurations and enforce limits
      const validationResult = this.validateModelCombinations(validated.models);
      
      if (validationResult.valid_configs.length === 0) {
        const errorResponse: ConsensusResponse = {
          status: 'consensus_failed',
          models_used: [],
          models_skipped: validationResult.skipped_entries,
          models_errored: [],
          responses: [],
          next_steps: 'Please provide valid model configurations with proper model names and stance values.',
        };
        return this.formatOutput(JSON.stringify(errorResponse, null, 2), 'error', 'json');
      }

      // Set up model context for consensus (using first model as representative)
      if (!this._modelContext) {
        const firstModel = validationResult.valid_configs[0]?.model || 'flash';
        this._modelContext = new ModelContext(firstModel);
      }

      // Handle conversation continuation if specified (matching Python pattern)
      if (validated.continuation_id) {
        const threadContext = await getThread(validated.continuation_id);
        if (threadContext) {
          // Build conversation history using the same pattern as other tools
          const [conversationContext] = await buildConversationHistory(threadContext, this._modelContext);
          if (conversationContext) {
            // Add conversation context to the beginning of the prompt
            validated.prompt = `${conversationContext}\n\n${validated.prompt}`;
          }
        }
      }

      // Prepare the consensus prompt with context
      const consensusPrompt = await this.prepareConsensusPrompt(validated);

      // Get providers for valid model configurations
      const providerConfigs = await this.getProviderConfigs(
        validationResult.valid_configs, 
        validationResult.skipped_entries
      );

      if (providerConfigs.length === 0) {
        const errorResponse: ConsensusResponse = {
          status: 'consensus_failed',
          models_used: [],
          models_skipped: validationResult.skipped_entries,
          models_errored: [],
          responses: [],
          next_steps: 'No model providers available. Please check that the specified models have configured API keys.',
        };
        return this.formatOutput(JSON.stringify(errorResponse, null, 2), 'error', 'json');
      }

      // Execute consensus analysis sequentially (matches Python implementation)
      logger.info(`Executing consensus analysis with ${providerConfigs.length} models sequentially`);
      const responses = await this.executeConsensusSequentially(providerConfigs, consensusPrompt, validated);
      
      // Enforce minimum success requirement
      const successfulResponses = responses.filter(r => r.status === 'success');
      if (successfulResponses.length === 0) {
        const errorResponse: ConsensusResponse = {
          status: 'consensus_failed',
          models_used: [],
          models_skipped: validationResult.skipped_entries,
          models_errored: responses.map(r => r.status === 'error' ? 
            `${r.model}:${r.stance}` : r.model
          ),
          responses,
          next_steps: 'All model calls failed. Please retry with different models or check error messages.',
        };
        return this.formatOutput(JSON.stringify(errorResponse, null, 2), 'error', 'json');
      }

      // Format consensus output
      const consensusResult = this.formatConsensusResponse(responses, validationResult.skipped_entries);
      
      // Store in conversation memory if continuation_id provided
      if (validated.continuation_id) {
        await this.storeConsensusResult(validated, consensusResult, responses);
      }

      // Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        validated.prompt,
        JSON.stringify(consensusResult),
        'consensus-orchestrator',
        0, // Input tokens (calculated by individual models)
        0, // Output tokens (calculated by individual models)  
        validated.continuation_id,
        validated.files || [],
        validated.files || [],
      );

      return this.formatOutput(
        JSON.stringify(consensusResult, null, 2),
        'success',
        'json',
        {
          models_consulted: successfulResponses.length,
          total_attempts: responses.length,
          execution_time_ms: Date.now() - startTime,
        },
        continuationOffer,
      );

    } catch (error) {
      logger.error('Consensus tool error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          'error',
        );
      }
      
      return this.formatOutput(
        `Consensus analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    }
  }

  /**
   * Normalize stance to canonical form
   */
  private normalizeStance(stance?: string): ConsensusStance {
    if (!stance) return 'neutral';
    
    const normalizedStance = stance.toLowerCase();
    
    if (SUPPORTIVE_STANCES.has(normalizedStance)) {
      return 'for';
    } else if (CRITICAL_STANCES.has(normalizedStance)) {
      return 'against';
    } else if (NEUTRAL_STANCES.has(normalizedStance)) {
      return 'neutral';
    } else {
      // Unknown stances default to neutral for robustness
      logger.warn(`Unknown stance '${stance}' provided, defaulting to 'neutral'`);
      return 'neutral';
    }
  }

  /**
   * Validate model configurations and enforce instance limits
   */
  private validateModelCombinations(modelConfigs: ModelConfig[]): ModelValidationResult {
    const validConfigs: NormalizedModelConfig[] = [];
    const skippedEntries: string[] = [];
    const combinationCounts = new Map<string, number>(); // Track (model, stance) -> count

    for (const config of modelConfigs) {
      try {
        // Normalize stance
        const normalizedStance = this.normalizeStance(config.stance);
        
        // Create normalized config
        const normalizedConfig: NormalizedModelConfig = {
          model: config.model,
          stance: normalizedStance,
          stance_prompt: config.stance_prompt,
        };

        const combinationKey = `${config.model}:${normalizedStance}`;
        const currentCount = combinationCounts.get(combinationKey) || 0;

        if (currentCount >= DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION) {
          // Already have max instances of this model+stance combination
          skippedEntries.push(
            `${config.model}:${normalizedStance} (max ${DEFAULT_CONSENSUS_MAX_INSTANCES_PER_COMBINATION} instances)`
          );
          continue;
        }

        combinationCounts.set(combinationKey, currentCount + 1);
        validConfigs.push(normalizedConfig);

      } catch (error) {
        // Invalid configuration
        skippedEntries.push(`${config.model} (${error instanceof Error ? error.message : 'invalid config'})`);
        continue;
      }
    }

    return { valid_configs: validConfigs, skipped_entries: skippedEntries };
  }

  /**
   * Prepare consensus prompt with advanced file handling and validation (matching Python implementation)
   */
  private async prepareConsensusPrompt(request: ConsensusRequest): Promise<string> {
    // Check for prompt.txt in files (matching Python handle_prompt_file behavior)
    let userContent = request.prompt;
    let updatedFiles = request.files;
    
    if (request.files && request.files.length > 0) {
      // Check if any file is named 'prompt.txt' and use its content instead
      const promptFile = request.files.find(file => file.endsWith('prompt.txt'));
      if (promptFile) {
        try {
          const promptContent = await readFile(promptFile);
          if (promptContent.trim()) {
            userContent = promptContent;
            // Remove prompt.txt from files list since we used its content
            updatedFiles = request.files.filter(file => !file.endsWith('prompt.txt'));
          }
        } catch (error) {
          logger.warn(`Failed to read prompt file ${promptFile}: ${error}`);
        }
      }
    }

    // Check user input size at MCP transport boundary (matching Python check_prompt_size)
    this.checkPromptSize(userContent);

    // Add focus areas if specified
    if (request.focus_areas && request.focus_areas.length > 0) {
      const focusAreasText = '\n\nSpecific focus areas for this analysis:\n' + 
        request.focus_areas.map(area => `- ${area}`).join('\n');
      userContent += focusAreasText;
    }

    // Add context files if provided (advanced file handling with filtering)
    if (updatedFiles && updatedFiles.length > 0) {
      const fileContents = await this.prepareFileContentForPrompt(
        updatedFiles, 
        request.continuation_id || undefined, 
        'Context files'
      );
      
      if (fileContents.content) {
        userContent = `${userContent}\n\n=== CONTEXT FILES ===\n${fileContents.content}\n=== END CONTEXT ===`;
        this._actuallyProcessedFiles = fileContents.processedFiles;
      }
    }

    // Final token limit validation (matching Python _validate_token_limit)
    if (this._modelContext) {
      const tokenAllocation = await this._modelContext.calculateTokenAllocation();
      const estimatedTokens = Math.ceil(userContent.length / 4); // Rough estimation
      const availableTokens = tokenAllocation.contentTokens;
      
      if (estimatedTokens > availableTokens) {
        logger.warn(`Content may exceed token limits: ${estimatedTokens} > ${availableTokens}`);
      }
    }

    return userContent;
  }

  /**
   * Prepare file content for prompt with advanced processing (matching Python implementation)
   */
  private async prepareFileContentForPrompt(
    files: string[], 
    continuationId?: string, 
    context = 'Files'
  ): Promise<{ content: string; processedFiles: string[] }> {
    const fileContents: string[] = [];
    const processedFiles: string[] = [];

    // Check total file size before processing
    try {
      await checkTotalFileSize(files);
    } catch (error) {
      logger.warn(`File size check failed: ${error}`);
      return { content: '', processedFiles: [] };
    }

    for (const filePath of files) {
      try {
        const fileContent = await readFile(filePath);
        const tokens = await estimateFileTokens(filePath);
        
        fileContents.push(`=== ${filePath} ===\n${fileContent}`);
        processedFiles.push(filePath);
        
        logger.debug(`Processed file ${filePath}: ${tokens} tokens`);
      } catch (error) {
        logger.warn(`Failed to read file ${filePath}: ${error}`);
        fileContents.push(`=== ${filePath} ===\n[File could not be read: ${error}]`);
      }
    }

    return {
      content: fileContents.join('\n\n'),
      processedFiles
    };
  }

  /**
   * Get model provider for the specified model (matching Python base class pattern)
   */
  private async getModelProvider(modelName: string): Promise<any> {
    const provider = await modelProviderRegistry.getProviderForModel(modelName);
    if (!provider) {
      throw new Error(`No provider supports the requested model: ${modelName}`);
    }
    return provider;
  }

  /**
   * Get providers for valid model configurations
   */
  private async getProviderConfigs(
    validConfigs: NormalizedModelConfig[], 
    skippedEntries: string[]
  ): Promise<Array<{ provider: any; config: NormalizedModelConfig }>> {
    const providerConfigs: Array<{ provider: any; config: NormalizedModelConfig }> = [];
    const providerCache = new Map(); // Cache to avoid duplicate lookups

    for (const modelConfig of validConfigs) {
      try {
        // Check cache first
        let provider = providerCache.get(modelConfig.model);
        if (!provider) {
          // Look up provider and cache it (using base class pattern)
          provider = await this.getModelProvider(modelConfig.model);
          providerCache.set(modelConfig.model, provider);
        }

        if (provider) {
          providerConfigs.push({ provider, config: modelConfig });
        } else {
          throw new Error('Provider not available');
        }
      } catch (error) {
        // Track failed models
        const modelDisplay = modelConfig.stance !== 'neutral' ? 
          `${modelConfig.model}:${modelConfig.stance}` : modelConfig.model;
        skippedEntries.push(`${modelDisplay} (provider not available: ${error})`);
      }
    }

    return providerConfigs;
  }

  /**
   * Execute consensus analysis sequentially (matches Python implementation)
   */
  private async executeConsensusSequentially(
    providerConfigs: Array<{ provider: any; config: NormalizedModelConfig }>,
    prompt: string,
    request: ConsensusRequest
  ): Promise<ModelResponse[]> {
    const responses: ModelResponse[] = [];

    logger.info(`Processing ${providerConfigs.length} models sequentially`);

    for (let i = 0; i < providerConfigs.length; i++) {
      const { provider, config } = providerConfigs[i];
      
      try {
        logger.info(`Processing ${config.model}:${config.stance} sequentially (${i + 1}/${providerConfigs.length})`);

        const response = await this.getSingleModelResponse(provider, config, prompt, request);
        responses.push(response);

      } catch (error) {
        logger.error(`Failed to get response from ${config.model}:${config.stance}: ${error}`);
        responses.push({
          model: config.model,
          stance: config.stance,
          status: 'error',
          error: `Unhandled exception: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    logger.info(`Sequential processing completed for ${responses.length} models`);
    return responses;
  }

  /**
   * Get response from a single model with stance-enhanced prompt
   */
  private async getSingleModelResponse(
    provider: any,
    config: NormalizedModelConfig,
    prompt: string,
    request: ConsensusRequest
  ): Promise<ModelResponse> {
    logger.debug(`Getting response from ${config.model} with stance '${config.stance}'`);

    try {
      // Create stance-enhanced system prompt
      const systemPrompt = getStanceEnhancedPrompt(config.stance, config.stance_prompt);

      // Create model request
      const modelRequest = await this.createModelRequest(
        prompt,
        systemPrompt,
        config.model,
        request.temperature ?? this.defaultTemperature,
        request.use_websearch,
      );

      // Generate response
      const response = await provider.generateResponse(modelRequest);

      return {
        model: config.model,
        stance: config.stance,
        status: 'success',
        verdict: response.content,
        metadata: {
          provider: provider.name || 'unknown',
          usage: response.usage ? {
            inputTokens: response.usage.inputTokens || 0,
            outputTokens: response.usage.outputTokens || 0,
          } : undefined,
          custom_stance_prompt: !!config.stance_prompt,
        },
      };
    } catch (error) {
      logger.error(`Error getting response from ${config.model}:${config.stance}: ${error}`);
      return {
        model: config.model,
        stance: config.stance,
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format consensus responses into structured output
   */
  private formatConsensusResponse(responses: ModelResponse[], skippedEntries: string[]): ConsensusResponse {
    // Separate successful and failed responses
    const successfulResponses = responses.filter(r => r.status === 'success');
    const failedResponses = responses.filter(r => r.status === 'error');

    logger.info(`Formatting consensus: ${successfulResponses.length} successful, ${failedResponses.length} failed`);

    const modelsUsed = successfulResponses.map(r => 
      r.stance !== 'neutral' ? `${r.model}:${r.stance}` : r.model
    );
    const modelsErrored = failedResponses.map(r => 
      r.stance !== 'neutral' ? `${r.model}:${r.stance}` : r.model
    );

    return {
      status: successfulResponses.length > 0 ? 'consensus_success' : 'consensus_failed',
      models_used: modelsUsed,
      models_skipped: skippedEntries,
      models_errored: modelsErrored,
      responses: responses,
      next_steps: this.getSynthesisGuidance(successfulResponses, failedResponses),
    };
  }

  /**
   * Generate synthesis guidance for Claude
   */
  private getSynthesisGuidance(
    successfulResponses: ModelResponse[], 
    failedResponses: ModelResponse[]
  ): string {
    if (successfulResponses.length === 0) {
      return 'No models provided successful responses. Please retry with different models or check error messages.';
    }

    if (successfulResponses.length === 1) {
      return 'Only one model provided a successful response. Synthesize based on the available perspective and indicate areas where additional expert input would be valuable.';
    }

    // Multiple successful responses - provide comprehensive synthesis guidance
    let guidance = 'Claude, synthesize these perspectives by first identifying the key points of ' +
      '**agreement** and **disagreement** between the models. Then provide your final, ' +
      'consolidated recommendation, explaining how you weighed the different opinions and ' +
      'why your proposed solution is the most balanced approach. Explicitly address the ' +
      'most critical risks raised by each model and provide actionable next steps for implementation.';

    if (failedResponses.length > 0) {
      guidance += ` Note: ${failedResponses.length} model(s) failed to respond - consider this ` +
        'partial consensus and indicate where additional expert input would strengthen the analysis.';
    }

    return guidance;
  }

  /**
   * Store consensus result in conversation memory (matching Python implementation)
   */
  private async storeConsensusResult(
    request: ConsensusRequest,
    result: ConsensusResponse,
    responses: ModelResponse[]
  ): Promise<void> {
    try {
      if (!request.continuation_id) return;

      // Filter successful and failed responses
      const successfulResponses = responses.filter(r => r.status === 'success');
      const failedResponses = responses.filter(r => r.status === 'error');

      // Prepare metadata for conversation storage (matching Python format)
      const metadata = {
        tool_type: 'consensus',
        models_used: successfulResponses.map(r => r.model),
        models_skipped: result.models_skipped,
        models_errored: failedResponses.map(r => r.model),
        individual_responses: successfulResponses, // Only store successful responses
      };

      // Store the consensus turn with special metadata (matching Python add_turn pattern)
      await addTurn(
        request.continuation_id,
        'assistant',
        JSON.stringify(result),
        {
          modelName: 'consensus', // Special model name for consensus
          inputTokens: 0,
          outputTokens: 0,
          tool: 'consensus',
          files: this._actuallyProcessedFiles || request.files || [],
          metadata,
        }
      );
    } catch (error) {
      logger.error('Error storing consensus result in conversation memory:', error);
      // Continue execution even if conversation memory fails
    }
  }
}