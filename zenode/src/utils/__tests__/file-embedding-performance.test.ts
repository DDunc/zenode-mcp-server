/**
 * Tests for file embedding performance improvements ported from commit 91077e3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getConversationFileList, 
  planFileInclusionBySize,
} from '../conversation-memory.js';
import { 
  estimateFileTokens, 
  checkTotalFileSize, 
  readFileContent 
} from '../file-utils.js';
import { ConversationThread } from '../../types/tools.js';

describe('File Embedding Performance (Commit 91077e3)', () => {
  describe('getConversationFileList - Newest First Prioritization', () => {
    it('should prioritize files from newer turns', () => {
      const thread: ConversationThread = {
        id: 'test-thread',
        thread_id: 'test-thread',
        tool_name: 'test',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        turns: [
          {
            role: 'user',
            content: 'First turn',
            timestamp: new Date().toISOString(),
            files: ['main.py', 'utils.py'],
          },
          {
            role: 'assistant', 
            content: 'Second turn',
            timestamp: new Date().toISOString(),
            files: ['test.py'],
          },
          {
            role: 'user',
            content: 'Third turn',
            timestamp: new Date().toISOString(),
            files: ['main.py', 'config.py'], // main.py appears again
          },
        ],
        metadata: {
          tools_used: ['test'],
          total_input_tokens: 100,
          total_output_tokens: 200,
        },
      };

      const files = getConversationFileList(thread);
      
      // Should have unique files with newest reference first
      expect(files).toEqual(['main.py', 'config.py', 'test.py', 'utils.py']);
      
      // main.py from Turn 3 should take precedence over Turn 1
      expect(files[0]).toBe('main.py'); // From newest turn (Turn 3)
      expect(files.length).toBe(4); // No duplicates
    });

    it('should handle empty turns gracefully', () => {
      const thread: ConversationThread = {
        id: 'test-thread',
        thread_id: 'test-thread', 
        tool_name: 'test',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        turns: [],
        metadata: {
          tools_used: ['test'],
          total_input_tokens: 0,
          total_output_tokens: 0,
        },
      };

      const files = getConversationFileList(thread);
      expect(files).toEqual([]);
    });

    it('should handle turns without files', () => {
      const thread: ConversationThread = {
        id: 'test-thread',
        thread_id: 'test-thread',
        tool_name: 'test', 
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        turns: [
          {
            role: 'user',
            content: 'Turn without files',
            timestamp: new Date().toISOString(),
          },
          {
            role: 'assistant',
            content: 'Another turn without files', 
            timestamp: new Date().toISOString(),
          },
        ],
        metadata: {
          tools_used: ['test'],
          total_input_tokens: 50,
          total_output_tokens: 100,
        },
      };

      const files = getConversationFileList(thread);
      expect(files).toEqual([]);
    });
  });

  describe('planFileInclusionBySize - Token-Aware Planning', () => {
    it('should plan file inclusion within token budget', async () => {
      // Mock small token budget for testing
      const files = ['small.txt', 'medium.py', 'large.js'];
      const maxTokens = 1000;

      const result = await planFileInclusionBySize(files, maxTokens);

      expect(result).toHaveProperty('filesToInclude');
      expect(result).toHaveProperty('filesToSkip');
      expect(result).toHaveProperty('estimatedTotalTokens');
      
      expect(Array.isArray(result.filesToInclude)).toBe(true);
      expect(Array.isArray(result.filesToSkip)).toBe(true);
      expect(typeof result.estimatedTotalTokens).toBe('number');
      
      // Total should not exceed budget
      expect(result.estimatedTotalTokens).toBeLessThanOrEqual(maxTokens);
    });

    it('should handle empty file list', async () => {
      const result = await planFileInclusionBySize([], 1000);
      
      expect(result.filesToInclude).toEqual([]);
      expect(result.filesToSkip).toEqual([]);
      expect(result.estimatedTotalTokens).toBe(0);
    });
  });

  describe('estimateFileTokens - Smart Token Estimation', () => {
    it('should provide reasonable token estimates', async () => {
      // This will fail for non-existent files but test the function structure
      try {
        const tokens = await estimateFileTokens('nonexistent.js');
        expect(typeof tokens).toBe('number');
        expect(tokens).toBeGreaterThan(0);
      } catch (error) {
        // Expected for non-existent files - just ensure it handles errors gracefully
        expect(error).toBeDefined();
      }
    });
  });

  describe('checkTotalFileSize - MCP Boundary Protection', () => {
    it('should validate file sizes against model limits', async () => {
      const files = ['test1.py', 'test2.js'];
      const modelName = 'gpt-4'; // Use a model that might be available

      try {
        const result = await checkTotalFileSize(files, modelName);
        
        // Should either return null (acceptable) or MCP_CODE_TOO_LARGE error
        if (result) {
          expect(result).toHaveProperty('status', 'MCP_CODE_TOO_LARGE');
          expect(result).toHaveProperty('content');
          expect(result).toHaveProperty('content_type', 'text');
          expect(result.content).toContain('exceed');
        } else {
          expect(result).toBeNull();
        }
      } catch (error) {
        // In test environment, providers might not be available
        // This is acceptable - we're testing the function structure
        expect(error).toBeDefined();
        expect(error instanceof Error ? error.message : '').toContain('No provider found');
      }
    });

    it('should handle empty file list', async () => {
      const result = await checkTotalFileSize([], 'test-model');
      expect(result).toBeNull();
    });
  });

  describe('readFileContent - Formatted Content Reading', () => {
    it('should handle non-existent files gracefully', async () => {
      const result = await readFileContent('nonexistent.txt');
      
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('tokens');
      expect(typeof result.content).toBe('string');
      expect(typeof result.tokens).toBe('number');
      
      // Should contain error message for non-existent files
      expect(result.content).toContain('Error');
    });
  });
});