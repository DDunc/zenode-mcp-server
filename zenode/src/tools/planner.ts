/**
 * Planner Tool - Interactive Step-by-Step Planning
 * 
 * This tool helps break down complex ideas, problems, or projects into multiple
 * manageable steps. It enables Claude to think through larger problems sequentially, creating
 * detailed action plans with clear dependencies and alternatives where applicable.
 * 
 * Key Features:
 * - Sequential step-by-step planning with context awareness
 * - Branching support for exploring alternative approaches  
 * - Revision capabilities to update earlier decisions
 * - Multi-session continuation with Redis persistence
 * - Dynamic step count adjustment as planning progresses
 * - Cross-tool integration with zenode ecosystem
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolOutput } from '../types/tools.js';
import { 
  PlannerToolRequest, 
  PlannerToolResponse, 
  PlanStep, 
  PlanningSession,
  BranchInfo,
  ContinuationRule,
  ContinuationContext,
  PLANNER_FIELD_DESCRIPTIONS 
} from '../types/planner.js';
import { 
  PLANNER_PROMPT, 
  PLANNER_SYSTEM_CONTEXT,
  PLANNER_RESPONSE_TEMPLATES,
  PLANNER_VALIDATION_MESSAGES 
} from '../systemprompts/planner-prompt.js';
import { createThread, getThread, addTurn } from '../utils/conversation-memory.js';
import { modelProviderRegistry } from '../providers/registry.js';
import { TEMPERATURE_BALANCED } from '../config.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Zod schema for planner tool request validation
 */
const PlannerRequestSchema = z.object({
  // Required fields
  step: z.string().min(1, "Step description cannot be empty"),
  step_number: z.number().int().min(1, "Step number must be at least 1"),
  total_steps: z.number().int().min(1, "Total steps must be at least 1"),
  next_step_required: z.boolean(),

  // Optional revision/branching fields
  is_step_revision: z.boolean().optional().default(false),
  revises_step_number: z.number().int().optional(),
  is_branch_point: z.boolean().optional().default(false),
  branch_from_step: z.number().int().optional(),
  branch_id: z.string().optional().default("main"),
  more_steps_needed: z.boolean().optional().default(false),

  // Optional continuation field
  continuation_id: z.string().uuid().optional(),

  // Base tool request fields
  model: z.string().optional(),
  temperature: z.number().optional(),
  thinking_mode: z.string().optional(),
  use_websearch: z.boolean().optional(),
}).refine((data) => {
  // Validation: revision requires valid step number
  if (data.is_step_revision && (!data.revises_step_number || data.revises_step_number >= data.step_number)) {
    return false;
  }
  
  // Validation: branch point requires valid branch info
  if (data.is_branch_point && !data.branch_from_step) {
    return false;
  }
  
  return true;
}, {
  message: "Invalid revision or branch configuration"
});

export class PlannerTool extends BaseTool {
  name = 'planner';
  description = `INTERACTIVE SEQUENTIAL PLANNER - Break down complex tasks through step-by-step planning. 
This tool enables you to think sequentially, building plans incrementally with the ability 
to revise, branch, and adapt as understanding deepens.

How it works:
- Start with step 1: describe the task/problem to plan
- Continue with subsequent steps, building the plan piece by piece
- Adjust total_steps estimate as you progress
- Revise previous steps when new insights emerge
- Branch into alternative approaches when needed
- Add more steps even after reaching the initial estimate

Key features:
- Sequential thinking with full context awareness
- Branching for exploring alternative strategies
- Revision capabilities to update earlier decisions
- Multi-session continuation with Redis persistence
- Dynamic step count adjustment
- Integration with zenode tool ecosystem

Perfect for: complex project planning, system design with unknowns, 
migration strategies, architectural decisions, problem decomposition.`;

  defaultTemperature = TEMPERATURE_BALANCED;
  modelCategory = 'all' as const;

  private stepHistory: PlanStep[] = [];
  private branches: Record<string, PlanStep[]> = {};
  private currentSession?: PlanningSession;

  getZodSchema() {
    return PlannerRequestSchema;
  }

  getSystemPrompt(): string {
    return PLANNER_PROMPT + "\n\n" + PLANNER_SYSTEM_CONTEXT;
  }

  getInputSchema(): object {
    return {
      type: "object",
      properties: {
        step: {
          type: "string",
          description: PLANNER_FIELD_DESCRIPTIONS.step,
        },
        step_number: {
          type: "integer",
          minimum: 1,
          description: PLANNER_FIELD_DESCRIPTIONS.step_number,
        },
        total_steps: {
          type: "integer", 
          minimum: 1,
          description: PLANNER_FIELD_DESCRIPTIONS.total_steps,
        },
        next_step_required: {
          type: "boolean",
          description: PLANNER_FIELD_DESCRIPTIONS.next_step_required,
        },
        is_step_revision: {
          type: "boolean",
          description: PLANNER_FIELD_DESCRIPTIONS.is_step_revision,
        },
        revises_step_number: {
          type: "integer",
          description: PLANNER_FIELD_DESCRIPTIONS.revises_step_number,
        },
        is_branch_point: {
          type: "boolean", 
          description: PLANNER_FIELD_DESCRIPTIONS.is_branch_point,
        },
        branch_from_step: {
          type: "integer",
          description: PLANNER_FIELD_DESCRIPTIONS.branch_from_step,
        },
        branch_id: {
          type: "string",
          description: PLANNER_FIELD_DESCRIPTIONS.branch_id,
        },
        more_steps_needed: {
          type: "boolean",
          description: PLANNER_FIELD_DESCRIPTIONS.more_steps_needed,
        },
        continuation_id: {
          type: "string",
          format: "uuid",
          description: PLANNER_FIELD_DESCRIPTIONS.continuation_id,
        },
      },
      required: ["step", "step_number", "total_steps", "next_step_required"],
    };
  }

  /**
   * Execute the planner tool with sophisticated continuation logic
   */
  async execute(args: Record<string, any>): Promise<ToolOutput> {
    const startTime = Date.now();
    const requestId = `planner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Validate request
      const validated = this.validateArgs<PlannerToolRequest>(args);
      
      logger.info(`Planner tool invoked for step ${validated.step_number}/${validated.total_steps}`);
      
      // Log the request (Redis-based conversation logger)
      await this.logToolRequest(requestId, validated, validated.continuation_id);

      // Adjust total steps if current step exceeds estimate
      if (validated.step_number > validated.total_steps) {
        validated.total_steps = validated.step_number;
      }

      // Determine continuation rule and setup context
      const continuationContext = await this.determineContinuationRule(validated);
      
      // Build the planning prompt with context
      const planningPrompt = await this.buildPlanningPrompt(validated, continuationContext);

      // Select model for planning
      const selectedModel = await this.selectModel(validated.model);
      const provider = await modelProviderRegistry.getProviderForModel(selectedModel);
      
      if (!provider) {
        throw new Error(`No provider available for model: ${selectedModel}`);
      }

      // Create model request
      const modelRequest = await this.createModelRequest(
        planningPrompt,
        this.getSystemPrompt(),
        selectedModel,
        validated.temperature ?? this.defaultTemperature,
        validated.use_websearch,
      );

      // Generate planning response
      logger.info(`Generating planning response with model: ${selectedModel}`);
      const response = await provider.generateResponse(modelRequest);

      // Process the response and create planning result
      const planningResult = await this.processPlanningResponse(validated, response, continuationContext);

      // Handle conversation memory storage
      await this.handleConversationMemory(validated, planningResult, continuationContext);

      // Update local session state
      this.updateSessionState(validated, planningResult);

      // Handle conversation threading
      const continuationOffer = await this.handleConversationThreading(
        this.name,
        `Step ${validated.step_number}: ${validated.step}`,
        planningResult.step_output,
        response.modelName,
        response.usage.inputTokens,
        response.usage.outputTokens,
        planningResult.continuation_id,
        [], // No files for planner
        [], // No files processed
      );

      return this.formatOutput(
        planningResult.step_output,
        'success',
        'text',
        {
          step_number: planningResult.step_number,
          continuation_id: planningResult.continuation_id,
          planning_complete: planningResult.planning_complete,
          plan_summary: planningResult.plan_summary,
          branches_available: planningResult.branches_available,
          revision_history: planningResult.revision_history,
          model_used: response.modelName,
          token_usage: response.usage,
        },
        continuationOffer,
      );

    } catch (error) {
      logger.error('Planner tool error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          'error',
        );
      }
      
      return this.formatOutput(
        `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    }
  }

  /**
   * Determine which continuation rule applies based on request parameters
   * Implements the 4-rule continuation logic from the Python version
   */
  private async determineContinuationRule(request: PlannerToolRequest): Promise<ContinuationContext> {
    const { continuation_id, step_number, next_step_required } = request;

    // RULE 1: No continuation_id + step_number=1 → Create NEW planning thread
    if (!continuation_id && step_number === 1) {
      return {
        rule: ContinuationRule.NEW_PLANNING_THREAD,
        thread_exists: false
      };
    }

    // RULE 2: continuation_id + step_number=1 → Load PREVIOUS COMPLETE PLAN as context
    if (continuation_id && step_number === 1) {
      const thread = await getThread(continuation_id);
      const previousContext = thread ? await this.extractPreviousPlanContext(thread) : undefined;
      
      return {
        rule: ContinuationRule.LOAD_PREVIOUS_CONTEXT,
        continuation_id,
        previous_plan_context: previousContext,
        thread_exists: !!thread
      };
    }

    // RULE 3: continuation_id + step_number>1 → Continue current plan (no context loading)
    if (continuation_id && step_number > 1) {
      return {
        rule: ContinuationRule.CONTINUE_CURRENT_PLAN,
        continuation_id,
        thread_exists: true // Assume exists for continuing session
      };
    }

    // RULE 4: next_step_required=false → Complete planning session
    if (!next_step_required) {
      return {
        rule: ContinuationRule.COMPLETE_PLANNING,
        continuation_id,
        thread_exists: true
      };
    }

    // Default case - treat as new thread
    return {
      rule: ContinuationRule.NEW_PLANNING_THREAD,
      thread_exists: false
    };
  }

  /**
   * Extract previous complete plan context from conversation thread
   */
  private async extractPreviousPlanContext(thread: any): Promise<string | undefined> {
    if (!thread || !thread.turns) return undefined;

    // Search for most recent COMPLETE PLAN from previous planning sessions
    for (const turn of [...thread.turns].reverse()) {
      if (turn.tool_name === 'planner' && turn.role === 'assistant') {
        try {
          // Try to parse as JSON first (new format)
          const turnData = JSON.parse(turn.content);
          if (typeof turnData === 'object' && turnData.planning_complete) {
            const planSummary = turnData.plan_summary || '';
            if (planSummary) {
              return planSummary.slice(0, 500);
            }
          }
        } catch {
          // Fallback to text format
          if (turn.content.includes('planning_complete')) {
            const planStart = turn.content.indexOf('COMPLETE PLAN:');
            if (planStart !== -1) {
              return turn.content.slice(planStart, planStart + 500) + '...';
            }
            return turn.content.slice(0, 300) + '...';
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Build the planning prompt with appropriate context
   */
  private async buildPlanningPrompt(
    request: PlannerToolRequest, 
    context: ContinuationContext
  ): Promise<string> {
    let prompt = PLANNER_PROMPT + "\n\n" + PLANNER_SYSTEM_CONTEXT + "\n\n";

    // Add previous plan context if loading from previous session
    if (context.previous_plan_context) {
      prompt += `\n\n=== PREVIOUS COMPLETE PLAN CONTEXT ===\n${context.previous_plan_context}\n=== END CONTEXT ===\n\n`;
    }

    // Add current step information
    prompt += `CURRENT PLANNING STEP:
Step Number: ${request.step_number}
Total Estimated Steps: ${request.total_steps}
Step Description: ${request.step}
Next Step Required: ${request.next_step_required}
`;

    // Add revision information if applicable
    if (request.is_step_revision) {
      prompt += `\nREVISION: This step revises step ${request.revises_step_number}\n`;
    }

    // Add branching information if applicable
    if (request.is_branch_point) {
      prompt += `\nBRANCH POINT: Creating branch "${request.branch_id}" from step ${request.branch_from_step}\n`;
    }

    // Add continuation information
    prompt += `\nCONTINUATION RULE: ${context.rule}\n`;

    prompt += `\nProvide a detailed, actionable planning step that advances the project toward completion.
Focus on specific, implementable actions with clear dependencies and success criteria.
Include recommendations for zenode tool integration where appropriate.`;

    return prompt;
  }

  /**
   * Process the AI response and create planning result
   */
  private async processPlanningResponse(
    request: PlannerToolRequest,
    response: any,
    context: ContinuationContext
  ): Promise<PlannerToolResponse> {
    // Generate or use existing continuation ID
    const continuationId = request.continuation_id || uuidv4();
    
    const planningResult: PlannerToolResponse = {
      step_number: request.step_number,
      step_output: response.content,
      continuation_id: continuationId,
      planning_complete: !request.next_step_required
    };

    // Add plan summary if planning is complete
    if (!request.next_step_required) {
      planningResult.plan_summary = `COMPLETE PLAN: ${request.step} (${request.step_number} steps completed)`;
    }

    // Add branch information if this is a branch point
    if (request.is_branch_point) {
      planningResult.branches_available = [request.branch_id || 'main'];
    }

    // Add revision history if this is a revision
    if (request.is_step_revision && request.revises_step_number) {
      planningResult.revision_history = [{
        step_number: request.revises_step_number,
        revision_count: 1, // Could be enhanced to track multiple revisions
        previous_content: `Previous version of step ${request.revises_step_number}`
      }];
    }

    return planningResult;
  }

  /**
   * Handle conversation memory storage for the planning step
   */
  private async handleConversationMemory(
    request: PlannerToolRequest,
    result: PlannerToolResponse,
    context: ContinuationContext
  ): Promise<void> {
    try {
      let continuationId = result.continuation_id;

      // Create new thread if needed (Rule 1)
      if (context.rule === ContinuationRule.NEW_PLANNING_THREAD) {
        continuationId = await createThread('planner', { tool: 'planner', session: 'planner-session' });
        result.continuation_id = continuationId;
      }

      // Store the planning step in conversation memory
      if (continuationId) {
        await addTurn(
          continuationId,
          'user',
          JSON.stringify(request),
          {
            modelName: 'user',
            inputTokens: 0,
            outputTokens: 0,
            tool: 'planner'
          }
        );

        await addTurn(
          continuationId,
          'assistant',
          JSON.stringify(result),
          {
            modelName: 'assistant',
            inputTokens: 0,
            outputTokens: 0,
            tool: 'planner'
          }
        );
      }
    } catch (error) {
      console.error('Error handling conversation memory:', error);
      // Continue execution even if conversation memory fails
    }
  }

  /**
   * Update local session state
   */
  private updateSessionState(request: PlannerToolRequest, result: PlannerToolResponse): void {
    const step: PlanStep = {
      step_number: request.step_number,
      content: request.step,
      branch_id: request.branch_id || 'main',
      parent_step: request.branch_from_step,
      children: []
    };

    this.stepHistory.push(step);

    // Handle branching
    if (request.is_branch_point && request.branch_id) {
      if (!this.branches[request.branch_id]) {
        this.branches[request.branch_id] = [];
      }
      this.branches[request.branch_id]?.push(step);
    }

    // Update current session
    if (!this.currentSession || this.currentSession.id !== result.continuation_id) {
      this.currentSession = {
        id: result.continuation_id,
        created_at: new Date().toISOString(),
        steps: [step],
        branches: this.branches,
        current_step: request.step_number,
        is_complete: result.planning_complete || false,
        plan_summary: result.plan_summary
      };
    } else {
      this.currentSession.steps.push(step);
      this.currentSession.current_step = request.step_number;
      this.currentSession.is_complete = result.planning_complete || false;
      if (result.plan_summary) {
        this.currentSession.plan_summary = result.plan_summary;
      }
    }
  }
}