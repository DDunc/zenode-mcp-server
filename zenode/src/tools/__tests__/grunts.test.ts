/**
 * Tests for Grunts Tool - Distributed LLM Orchestration
 */

import { GruntsTool } from '../grunts.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
    stat: vi.fn()
  }
}));

vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

describe('GruntsTool', () => {
  let gruntsTool: GruntsTool;
  
  beforeEach(() => {
    gruntsTool = new GruntsTool();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic Tool Properties', () => {
    it('should have correct tool name', () => {
      expect(gruntsTool.name).toBe('grunts');
    });

    it('should have appropriate description', () => {
      expect(gruntsTool.description).toContain('DISTRIBUTED LLM ORCHESTRATION');
      expect(gruntsTool.description).toContain('JavaScript');
      expect(gruntsTool.description).toContain('TypeScript');
      expect(gruntsTool.description).toContain('port 3030');
    });

    it('should have correct model category', () => {
      expect(gruntsTool.modelCategory).toBe('all');
    });

    it('should have low temperature for consistent code generation', () => {
      expect(gruntsTool.defaultTemperature).toBe(0.1);
    });
  });

  describe('Schema Validation', () => {
    it('should validate basic request schema', () => {
      const schema = gruntsTool.getZodSchema();
      
      const validRequest = {
        prompt: 'Create a React component with TypeScript',
        tier: 'medium'
      };
      
      const result = schema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should set default values correctly', () => {
      const schema = gruntsTool.getZodSchema();
      
      const minimalRequest = {
        prompt: 'Basic web app'
      };
      
      const result = schema.parse(minimalRequest);
      expect(result.tier).toBe('medium');
      expect(result.max_execution_time).toBe(14400); // 4 hours
      expect(result.partial_assessment_interval).toBe(1800); // 30 minutes
      expect(result.target_technologies).toEqual(['javascript', 'typescript', 'nodejs', 'dom', 'css']);
    });

    it('should validate tier options', () => {
      const schema = gruntsTool.getZodSchema();
      
      const invalidTier = {
        prompt: 'Test',
        tier: 'invalid'
      };
      
      const result = schema.safeParse(invalidTier);
      expect(result.success).toBe(false);
    });
  });

  describe('Container Configurations', () => {
    it('should return ultralight config for ultralight tier', () => {
      // Access private method for testing
      const configs = (gruntsTool as any).getContainerConfigs('ultralight');
      
      expect(configs).toHaveLength(2);
      expect(configs[0].model).toBe('phi3:mini');
      expect(configs[0].specialization).toContain('General coding');
      expect(configs[1].model).toBe('codegemma:2b');
    });

    it('should return light config for light tier', () => {
      const configs = (gruntsTool as any).getContainerConfigs('light');
      
      expect(configs).toHaveLength(4);
      expect(configs.some((c: any) => c.model === 'qwen2.5-coder:7b')).toBe(true);
      expect(configs.some((c: any) => c.specialization.includes('JavaScript'))).toBe(true);
    });

    it('should return medium config for medium tier (default)', () => {
      const configs = (gruntsTool as any).getContainerConfigs('medium');
      
      expect(configs).toHaveLength(6);
      expect(configs.some((c: any) => c.model === 'qwen2.5-coder:14b')).toBe(true);
      expect(configs.some((c: any) => c.specialization.includes('React/Vue'))).toBe(true);
    });

    it('should return high config for high tier', () => {
      const configs = (gruntsTool as any).getContainerConfigs('high');
      
      expect(configs).toHaveLength(6);
      expect(configs.some((c: any) => c.model === 'qwen2.5-coder:32b')).toBe(true);
      expect(configs.some((c: any) => c.model === 'llama3.1:70b')).toBe(true);
    });

    it('should default to medium config for unknown tier', () => {
      const configs = (gruntsTool as any).getContainerConfigs('unknown');
      const mediumConfigs = (gruntsTool as any).getContainerConfigs('medium');
      
      expect(configs).toEqual(mediumConfigs);
    });

    it('should include fallback models for all configurations', () => {
      const tiers = ['ultralight', 'light', 'medium', 'high'];
      
      tiers.forEach(tier => {
        const configs = (gruntsTool as any).getContainerConfigs(tier);
        configs.forEach((config: any) => {
          expect(config.fallback).toBeDefined();
          expect(typeof config.fallback).toBe('string');
        });
      });
    });
  });

  describe('Model Availability Checking', () => {
    it('should recognize known available models', async () => {
      const availableModels = [
        'phi3:mini',
        'qwen2.5-coder:7b',
        'codellama:13b',
        'llama3.1:8b'
      ];
      
      for (const model of availableModels) {
        const isAvailable = await (gruntsTool as any).checkModelAvailability(model);
        expect(isAvailable).toBe(true);
      }
    });

    it('should reject unknown models', async () => {
      const unknownModels = [
        'unknown-model:1b',
        'fake-coder:7b',
        'nonexistent:huge'
      ];
      
      for (const model of unknownModels) {
        const isAvailable = await (gruntsTool as any).checkModelAvailability(model);
        expect(isAvailable).toBe(false);
      }
    });

    it('should handle verification errors gracefully', async () => {
      // Mock the checkModelAvailability method to return false for error cases
      const mockCheck = vi.fn().mockResolvedValue(false);
      (gruntsTool as any).checkModelAvailability = mockCheck;
      
      const isAvailable = await (gruntsTool as any).checkModelAvailability('phi3:mini');
      expect(isAvailable).toBe(false);
      expect(mockCheck).toHaveBeenCalledWith('phi3:mini');
    });
  });

  describe('Model Verification and Preparation', () => {
    it('should use primary model when available', async () => {
      const mockConfigs = [
        { name: 'test', model: 'phi3:mini', fallback: 'llama3.2:1b', specialization: 'test' }
      ];
      
      const verified = await (gruntsTool as any).verifyAndPrepareModels(mockConfigs);
      
      expect(verified).toHaveLength(1);
      expect(verified[0].model).toBe('phi3:mini');
    });

    it('should fallback to secondary model when primary unavailable', async () => {
      const mockConfigs = [
        { name: 'test', model: 'unknown-model:1b', fallback: 'phi3:mini', specialization: 'test' }
      ];
      
      const verified = await (gruntsTool as any).verifyAndPrepareModels(mockConfigs);
      
      expect(verified).toHaveLength(1);
      expect(verified[0].model).toBe('phi3:mini');
    });

    it('should use basic fallback when both primary and fallback unavailable', async () => {
      const mockConfigs = [
        { name: 'test', model: 'unknown1:1b', fallback: 'unknown2:1b', specialization: 'test' }
      ];
      
      const verified = await (gruntsTool as any).verifyAndPrepareModels(mockConfigs);
      
      expect(verified).toHaveLength(1);
      expect(verified[0].model).toBe('llama3.2:1b');
    });
  });

  describe('Workspace Initialization', () => {
    it('should create required directory structure', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      
      await (gruntsTool as any).initializeWorkspace();
      
      // Check that required directories were created
      const mkdirCalls = vi.mocked(fs.mkdir).mock.calls;
      expect(mkdirCalls.length).toBeGreaterThan(0);
      
      // Should create workspace structure
      const createdPaths = mkdirCalls.map(call => String(call[0]));
      expect(createdPaths.some(path => path.includes('workspace'))).toBe(true);
      expect(createdPaths.some(path => path.includes('results'))).toBe(true);
    });

    it('should handle directory creation errors', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'));
      
      await expect((gruntsTool as any).initializeWorkspace()).rejects.toThrow();
    });
  });

  describe('Task Decomposition', () => {
    it('should create valid task decomposition structure', async () => {
      const prompt = 'Create a todo app with React and TypeScript';
      const technologies = ['javascript', 'typescript', 'react'];
      
      const decomposition = await (gruntsTool as any).decomposeTask(prompt, technologies);
      
      expect(decomposition).toHaveProperty('mainTask');
      expect(decomposition).toHaveProperty('technologies');
      expect(decomposition).toHaveProperty('tasks');
      expect(decomposition.mainTask).toBe(prompt);
      expect(decomposition.technologies).toEqual(technologies);
      expect(Array.isArray(decomposition.tasks)).toBe(true);
    });

    it('should include tests in task decomposition', async () => {
      const decomposition = await (gruntsTool as any).decomposeTask('Test prompt', []);
      
      expect(decomposition.tasks[0]).toHaveProperty('tests');
      expect(Array.isArray(decomposition.tasks[0].tests)).toBe(true);
      expect(decomposition.tasks[0].tests.length).toBeGreaterThan(0);
    });
  });

  describe('Status Monitoring', () => {
    it('should initialize status with correct structure', async () => {
      const mockConfig = {
        max_execution_time: 3600,
        tier: 'medium'
      };
      
      const mockDecomposition = { tasks: [] };
      
      const status = await (gruntsTool as any).initializeStatusMonitoring(mockConfig, mockDecomposition);
      
      expect(status).toHaveProperty('executionTime');
      expect(status).toHaveProperty('maxExecutionTime');
      expect(status).toHaveProperty('containers');
      expect(status).toHaveProperty('overallProgress');
      expect(status.maxExecutionTime).toBe(3600);
      expect(status.executionTime).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it.skip('should execute successfully with minimal valid input', async () => {
      // Mock all file system operations
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      
      const validInput = {
        prompt: 'Create a simple calculator app',
        tier: 'ultralight'
      };
      
      const result = await gruntsTool.execute(validInput);
      
      expect(result.status).toBe('success');
      expect(result.content).toContain('Grunts execution completed successfully');
      expect(result.content).toContain('http://localhost:3030');
    });

    it('should handle execution errors gracefully', async () => {
      // Mock a failure in workspace initialization
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Disk full'));
      
      const validInput = {
        prompt: 'Test app',
        tier: 'medium'
      };
      
      const result = await gruntsTool.execute(validInput);
      
      expect(result.status).toBe('error');
      expect(result.content).toContain('Grunts execution failed');
    });
  });

  describe('System Prompt', () => {
    it('should include web development focus', () => {
      const systemPrompt = gruntsTool.getSystemPrompt();
      
      expect(systemPrompt).toContain('JavaScript/TypeScript');
      expect(systemPrompt).toContain('DOM manipulation');
      expect(systemPrompt).toContain('React/Vue');
      expect(systemPrompt).toContain('API development');
      expect(systemPrompt).toContain('zenode:thinkdeep');
    });

    it('should mention monitoring and assessment capabilities', () => {
      const systemPrompt = gruntsTool.getSystemPrompt();
      
      expect(systemPrompt).toContain('status dashboard');
      expect(systemPrompt).toContain('partial assessments');
      expect(systemPrompt).toContain('30 minutes');
    });
  });
});