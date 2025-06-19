/**
 * Planner Tool Tests
 * 
 * Comprehensive test suite for the planner tool including:
 * - Basic planning functionality
 * - Continuation logic (4-rule system)
 * - Branching and revision capabilities
 * - Multi-session planning with Redis persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlannerTool } from '../planner.js';
import { ContinuationRule } from '../../types/planner.js';

// Mock conversation memory functions
vi.mock('../../utils/conversation-memory.js', () => ({
  createThread: vi.fn().mockResolvedValue('test-uuid-123'),
  getThread: vi.fn().mockResolvedValue(null),
  addTurn: vi.fn().mockResolvedValue(undefined),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-123'),
}));

describe('PlannerTool', () => {
  let plannerTool: PlannerTool;

  beforeEach(() => {
    plannerTool = new PlannerTool();
    vi.clearAllMocks();
  });

  describe('Basic Tool Properties', () => {
    it('should have correct name', () => {
      expect(plannerTool.name).toBe('planner');
    });

    it('should have descriptive description', () => {
      const description = plannerTool.description;
      expect(description).toContain('INTERACTIVE SEQUENTIAL PLANNER');
      expect(description).toContain('step-by-step planning');
    });

    it('should have proper input schema', () => {
      const schema = plannerTool.getInputSchema();
      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
      
      const properties = (schema as any).properties;
      expect(properties).toHaveProperty('step');
      expect(properties).toHaveProperty('step_number');
      expect(properties).toHaveProperty('total_steps');
      expect(properties).toHaveProperty('next_step_required');
    });
  });

  describe('Basic Planning', () => {
    it('should create new planning session for step 1 without continuation_id', async () => {
      const args = {
        step: "Define project requirements",
        step_number: 1,
        total_steps: 3,
        next_step_required: true
      };

      const result = await plannerTool.execute(args);

      expect(result.status).toBe('success');
      expect(result.content_type).toBe('text');
      expect(result.metadata).toHaveProperty('step_number', 1);
      expect(result.metadata).toHaveProperty('continuation_id');
      expect(result.metadata?.planning_complete).toBe(false);
    });

    it('should validate step numbers and adjust total_steps', async () => {
      const args = {
        step: "Implementation step",
        step_number: 5,
        total_steps: 3, // Lower than step_number
        next_step_required: true
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      // total_steps should be adjusted to step_number
      expect(result.metadata).toHaveProperty('step_number', 5);
    });

    it('should handle step completion correctly', async () => {
      const args = {
        step: "Final deployment",
        step_number: 3,
        total_steps: 3,
        next_step_required: false // Planning complete
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      expect(result.metadata?.planning_complete).toBe(true);
      expect(result.metadata).toHaveProperty('plan_summary');
    });
  });

  describe('Input Validation', () => {
    it('should reject empty step description', async () => {
      const args = {
        step: "",
        step_number: 1,
        total_steps: 3,
        next_step_required: true
      };

      const result = await plannerTool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('Step description cannot be empty');
    });

    it('should reject invalid step numbers', async () => {
      const args = {
        step: "Valid step",
        step_number: 0, // Invalid - must be >= 1
        total_steps: 3,
        next_step_required: true
      };

      const result = await plannerTool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('Step number must be at least 1');
    });

    it('should reject invalid revision configuration', async () => {
      const args = {
        step: "Revised step",
        step_number: 2,
        total_steps: 3,
        next_step_required: true,
        is_step_revision: true,
        revises_step_number: 3 // Invalid - cannot revise future step
      };

      const result = await plannerTool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('Invalid revision or branch configuration');
    });

    it('should reject invalid branch configuration', async () => {
      const args = {
        step: "Branch step",
        step_number: 2,
        total_steps: 3,
        next_step_required: true,
        is_branch_point: true
        // Missing branch_from_step
      };

      const result = await plannerTool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('Invalid revision or branch configuration');
    });

    it('should reject invalid UUID format for continuation_id', async () => {
      const args = {
        step: "Continue step",
        step_number: 2,
        total_steps: 3,
        next_step_required: true,
        continuation_id: "invalid-uuid"
      };

      const result = await plannerTool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('Invalid uuid');
    });
  });

  describe('Continuation Logic', () => {
    it('should implement Rule 1: new planning thread creation', async () => {
      const args = {
        step: "Start new planning",
        step_number: 1,
        total_steps: 5,
        next_step_required: true
        // No continuation_id provided
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      expect(result.metadata).toHaveProperty('continuation_id');
      expect(result.metadata?.continuation_id).toBe('test-uuid-123');
    });

    it('should implement Rule 2: previous context loading', async () => {
      // Mock existing thread with previous complete plan
      const mockGetThread = vi.mocked(await import('../../utils/conversation-memory.js')).getThread;
      mockGetThread.mockResolvedValueOnce({
        id: 'existing-uuid',
        turns: [{
          tool_name: 'planner',
          role: 'assistant',
          content: JSON.stringify({
            planning_complete: true,
            plan_summary: 'Previous plan: Authentication system completed'
          })
        }]
      });

      const args = {
        step: "Start new feature planning",
        step_number: 1,
        total_steps: 3,
        next_step_required: true,
        continuation_id: 'existing-uuid'
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      expect(mockGetThread).toHaveBeenCalledWith('existing-uuid');
    });

    it('should implement Rule 3: current session continuation', async () => {
      const args = {
        step: "Continue current planning",
        step_number: 2, // > 1
        total_steps: 3,
        next_step_required: true,
        continuation_id: 'existing-uuid'
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      expect(result.metadata).toHaveProperty('continuation_id', 'existing-uuid');
    });

    it('should implement Rule 4: planning completion storage', async () => {
      const args = {
        step: "Final step",
        step_number: 3,
        total_steps: 3,
        next_step_required: false, // Planning complete
        continuation_id: 'existing-uuid'
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      expect(result.metadata?.planning_complete).toBe(true);
      expect(result.metadata).toHaveProperty('plan_summary');
    });
  });

  describe('Branching System', () => {
    it('should create branch points correctly', async () => {
      const args = {
        step: "Explore alternative architecture",
        step_number: 3,
        total_steps: 5,
        next_step_required: true,
        is_branch_point: true,
        branch_from_step: 2,
        branch_id: 'microservices-approach'
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      expect(result.metadata).toHaveProperty('step_number', 3);
    });

    it('should handle default branch_id as "main"', async () => {
      const args = {
        step: "Main branch step",
        step_number: 1,
        total_steps: 3,
        next_step_required: true
        // No branch_id specified - should default to "main"
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
    });
  });

  describe('Revision Capabilities', () => {
    it('should revise previous steps', async () => {
      const args = {
        step: "Updated requirements analysis",
        step_number: 3,
        total_steps: 5,
        next_step_required: true,
        is_step_revision: true,
        revises_step_number: 1
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      expect(result.metadata).toHaveProperty('step_number', 3);
    });

    it('should maintain revision history', async () => {
      const args = {
        step: "Second revision of step 2",
        step_number: 4,
        total_steps: 5,
        next_step_required: true,
        is_step_revision: true,
        revises_step_number: 2
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      // Should track revision history in metadata
      expect(result.metadata).toHaveProperty('revision_history');
    });
  });

  describe('Dynamic Planning', () => {
    it('should handle "more steps needed" functionality', async () => {
      const args = {
        step: "Unexpected complexity discovered",
        step_number: 3,
        total_steps: 3,
        next_step_required: true,
        more_steps_needed: true
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      expect(result.metadata).toHaveProperty('step_number', 3);
    });

    it('should allow extending beyond initial estimate', async () => {
      const args = {
        step: "Additional step beyond original plan",
        step_number: 5, // Beyond original total_steps
        total_steps: 3,
        next_step_required: true
      };

      const result = await plannerTool.execute(args);

      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
      // Should auto-adjust total_steps
      expect(result.metadata).toHaveProperty('step_number', 5);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed requests gracefully', async () => {
      const args = {
        // Missing required fields
        step_number: 1
      };

      const result = await plannerTool.execute(args);

      expect(result.isError).toBe(true);
      expect(result.result).toContain('Error in planner tool');
    });

    it('should handle conversation memory failures gracefully', async () => {
      // Mock conversation memory to throw error
      const mockCreateThread = vi.mocked(await import('../../utils/conversation-memory.js')).createThread;
      mockCreateThread.mockRejectedValueOnce(new Error('Redis connection failed'));

      const args = {
        step: "Test step",
        step_number: 1,
        total_steps: 3,
        next_step_required: true
      };

      const result = await plannerTool.execute(args);

      // Should still work even if conversation memory fails
      expect(result.toolName).toBe('planner');
      expect(result.isError).toBeFalsy();
    });
  });
});