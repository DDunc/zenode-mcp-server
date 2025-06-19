/**
 * Planner tool types and interfaces
 * 
 * These types define the structure for the sophisticated planner tool that enables
 * step-by-step project breakdown with branching, revision, and multi-session capabilities.
 */

export interface PlanStep {
  step_number: number;
  content: string;
  branch_id: string;
  parent_step?: number;
  children: PlanStep[];
}

export interface PlannerToolRequest {
  // Required fields for each planning step
  step: string;
  step_number: number;
  total_steps: number;
  next_step_required: boolean;

  // Optional revision/branching fields
  is_step_revision?: boolean;
  revises_step_number?: number;
  is_branch_point?: boolean;
  branch_from_step?: number;
  branch_id?: string;
  more_steps_needed?: boolean;

  // Optional continuation field for multi-session planning
  continuation_id?: string;

  // Base tool request fields
  model?: string;
  temperature?: number;
  thinking_mode?: string;
  use_websearch?: boolean;
}

export interface PlannerToolResponse {
  step_number: number;
  step_output: string;
  continuation_id: string;
  planning_complete?: boolean;
  plan_summary?: string;
  branches_available?: string[];
  revision_history?: Array<{
    step_number: number;
    revision_count: number;
    previous_content: string;
  }>;
}

export interface PlanningSession {
  id: string;
  created_at: string;
  steps: PlanStep[];
  branches: Record<string, PlanStep[]>;
  current_step: number;
  is_complete: boolean;
  plan_summary?: string;
}

export interface BranchInfo {
  id: string;
  name: string;
  parent_step: number;
  description: string;
  steps: PlanStep[];
}

/**
 * Field descriptions for the planner tool schema
 * These provide detailed guidance to the AI model about how to use each parameter
 */
export const PLANNER_FIELD_DESCRIPTIONS = {
  step: "The current planning step description. Be specific and actionable. This should describe what needs to be planned, analyzed, or decided in this step.",
  
  step_number: "The sequential number of this planning step (starting from 1). Must be sequential within the current planning session.",
  
  total_steps: "Your current estimate of total steps needed for this planning session. This can be adjusted as planning progresses - if you reach the estimated total but need more steps, increase this number.",
  
  next_step_required: "Boolean indicating if another planning step is needed after this one. Set to false only when the current planning session is complete.",
  
  is_step_revision: "Boolean indicating if this is a revision of a previously completed step. Use when new information requires updating an earlier decision.",
  
  revises_step_number: "If is_step_revision is true, specify which step number this revision updates. Must be less than current step_number.",
  
  is_branch_point: "Boolean indicating if this step creates a branch point for exploring alternative approaches. Use when multiple valid strategies exist.",
  
  branch_from_step: "If is_branch_point is true, specify which step number this branch diverges from. Usually the current step or a previous decision point.",
  
  branch_id: "Identifier for the current branch (e.g., 'microservices-approach', 'monolith-approach'). Defaults to 'main' if not specified.",
  
  more_steps_needed: "Boolean indicating if additional steps beyond total_steps will be needed. Use to signal that planning is more complex than initially estimated.",
  
  continuation_id: "UUID for multi-session planning continuation. Omit for new planning sessions. Provide to continue or reference previous planning sessions."
} as const;

/**
 * Continuation logic rules for multi-session planning
 * These rules define how the planner handles context across sessions
 */
export enum ContinuationRule {
  NEW_PLANNING_THREAD = "new_planning_thread",      // No continuation_id + step_number=1
  LOAD_PREVIOUS_CONTEXT = "load_previous_context",  // continuation_id + step_number=1  
  CONTINUE_CURRENT_PLAN = "continue_current_plan",  // continuation_id + step_number>1
  COMPLETE_PLANNING = "complete_planning"           // next_step_required=false
}

export interface ContinuationContext {
  rule: ContinuationRule;
  continuation_id?: string;
  previous_plan_context?: string;
  thread_exists: boolean;
}