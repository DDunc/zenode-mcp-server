# TestGen Tool Migration Plan

## Overview
The TestGen tool generates comprehensive test suites by analyzing code paths, identifying edge cases, and producing test scaffolding that follows project conventions. It uses a multi-agent workflow approach with five expert personas to create high-quality, production-ready tests that catch real-world defects.

## Python Implementation Analysis

### Core Components

1. **Request Model** (`TestGenRequest`)
   - `files`: Required list of code files or directories to generate tests for (absolute paths)
   - `prompt`: Required string describing what to test, objectives, and scope/focus areas
   - `test_examples`: Optional list of existing test files for style/pattern reference
   - `thinking_mode`: Optional ('minimal'|'low'|'medium'|'high'|'max')
   - `continuation_id`: Optional thread continuation ID

2. **TestGenTool Class**
   - Extends `BaseTool`
   - Name: "testgen"
   - Model category: `EXTENDED_REASONING`
   - Default temperature: `TEMPERATURE_ANALYTICAL` (0.2)

3. **Key Features**
   - Multi-agent workflow (Context Profiler → Path Analyzer → Adversarial Thinker → Risk Prioritizer → Test Scaffolder)
   - Framework auto-detection from existing tests
   - Comprehensive edge case taxonomy
   - Test pattern following when examples provided
   - Token-aware test example sampling
   - Support for continuation when generating large test suites
   - Focus on realistic failure modes

4. **System Prompt**
   - Principal software engineer specializing in production code and test suites
   - Five expert personas for comprehensive analysis
   - Extensive edge case taxonomy covering real-world issues
   - Framework-specific test generation
   - Emphasis on deterministic, fast, self-documenting tests

## Node.js Implementation Plan

### 1. Type Definitions (`types/tools.d.ts`)
```typescript
export interface TestGenRequest extends ToolRequest {
  files: string[];
  prompt: string;
  test_examples?: string[];
  thinking_mode?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  continuation_id?: string;
}

export interface TestGenerationStatus {
  status: 'success' | 'clarification_required' | 'test_sample_needed' | 'more_tests_required';
  question?: string;
  files_needed?: string[];
  reason?: string;
  pending_tests?: string;
}
```

### 2. System Prompt (`systemprompts/testgen-prompt.ts`)
- Create a new file to store the testgen system prompt
- Export as a constant string
- Include multi-agent workflow and edge case taxonomy

### 3. TestGenTool Class (`tools/testgen.ts`)
```typescript
import { BaseTool } from './base.js';
import { TestGenRequest, ToolOutput, ToolModelCategory } from '../types/tools.js';
import { TESTGEN_PROMPT } from '../systemprompts/testgen-prompt.js';
import { TEMPERATURE_ANALYTICAL } from '../config.js';

export class TestGenTool extends BaseTool {
  name = 'testgen';
  description = 'COMPREHENSIVE TEST GENERATION - Creates thorough test suites...';
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema() {
    // Return JSON schema with all fields
  }
  
  getSystemPrompt() {
    return TESTGEN_PROMPT;
  }
  
  async execute(args: TestGenRequest): Promise<ToolOutput> {
    // 1. Validate request using zod schema
    // 2. Check prompt size
    // 3. Process test examples if provided
    // 4. Prepare prompt with code and examples
    // 5. Select appropriate model
    // 6. Make API call via provider
    // 7. Parse response for special statuses
    // 8. Format response
    // 9. Handle conversation threading
  }
  
  private processTestExamples(
    testExamples: string[], 
    continuationId?: string,
    availableTokens?: number
  ): { content: string; summary: string } {
    // Sample test examples intelligently
    // Use token budget allocation
    // Return formatted content and summary
  }
  
  private preparePrompt(request: TestGenRequest): string {
    // Build prompt with code files
    // Add test examples if provided
    // Include specific testing objectives
  }
  
  private parseSpecialStatus(response: string): TestGenerationStatus | null {
    // Check for JSON status responses
    // Handle clarification_required, test_sample_needed, more_tests_required
  }
}
```

### 4. Configuration Updates
- Ensure `TEMPERATURE_ANALYTICAL` (0.2) is in config.ts

### 5. Integration Steps
1. Update `index.ts` to import and register TestGenTool
2. Add TestGenRequest and TestGenerationStatus to tool types export
3. Implement smart test example sampling logic
4. Handle special status responses appropriately

### 6. Testing Requirements
- Unit tests for test example sampling
- Tests for different thinking modes
- Tests for special status parsing
- Tests for framework detection scenarios
- Tests for continuation handling
- Integration tests with mock code files

### 7. Special Considerations
- **Scope Specificity**: The tool emphasizes being specific about test scope - must handle vague requests appropriately
- **Framework Detection**: Must analyze existing tests to detect framework and patterns
- **Test Example Sampling**: When large test directories are provided:
  - Use token budget (25% of available)
  - Prefer smaller, representative tests
  - Use deterministic sampling for consistency
- **Multi-Agent Workflow**:
  1. Context Profiler: Identifies language, framework, conventions
  2. Path Analyzer: Maps code paths and external interactions
  3. Adversarial Thinker: Identifies realistic failure modes
  4. Risk Prioritizer: Ranks by production impact
  5. Test Scaffolder: Generates framework-specific tests
- **Edge Case Taxonomy**: Comprehensive list including:
  - Data shape issues (null, empty, malformed)
  - Numeric boundaries
  - Temporal pitfalls
  - Concurrency/async issues
  - Security surfaces
- **Continuation Support**: For large test suites, supports generating essential tests first then continuing

### 8. Dependencies
- No new npm packages required
- Uses existing zod validation
- Leverages base tool functionality
- Integrates with existing provider system

### 9. Migration Order
This tool can be implemented in parallel with other tools. It's well-suited for implementation after the base infrastructure and file handling utilities are in place.

### 10. Output Format Example
The tool should produce output in this format:
```typescript
// tests/user.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { User } from '../src/user';

describe('User.login()', () => {
  let user: User;
  
  beforeEach(() => {
    user = new User();
  });
  
  // Happy path
  it('should return token for valid credentials', async () => {
    const token = await user.login('valid@email.com', 'correctPassword');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });
  
  // Edge case: null/undefined inputs
  it('should throw error for null email', async () => {
    await expect(user.login(null, 'password')).rejects.toThrow('Email is required');
  });
  
  // Security: SQL injection attempt
  it('should sanitize email input to prevent injection', async () => {
    const maliciousEmail = "admin'--";
    await expect(user.login(maliciousEmail, 'password')).rejects.toThrow('Invalid credentials');
  });
  
  // Concurrency: race condition
  it('should handle concurrent login attempts', async () => {
    const promises = Array(10).fill(null).map(() => 
      user.login('test@email.com', 'password')
    );
    const results = await Promise.allSettled(promises);
    // Verify no race conditions in token generation
  });
});

{"status": "more_tests_required",
"pending_tests": "test_password_validation (tests/user.test.ts), test_session_timeout (tests/user.test.ts)"}
```

### 11. Framework Detection Examples
The tool should detect and use appropriate frameworks:
- **JavaScript/TypeScript**: Jest, Vitest, Mocha
- **Python**: pytest, unittest
- **Java**: JUnit 5, TestNG
- **C#**: xUnit.net, NUnit, MSTest
- **Go**: built-in testing package
- **Rust**: built-in #[test]