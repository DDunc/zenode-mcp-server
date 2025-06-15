# Tool Migration Plans - Consistency Review Report

## Overview
This report analyzes the consistency across all 6 tool migration plans to ensure a cohesive implementation approach.

## Consistency Analysis

### ✅ Strong Consistency Found

1. **Naming Conventions**
   - All tools follow pattern: `{ToolName}Tool` class
   - Request types: `{ToolName}Request` (except Debug simplified to `DebugRequest`)
   - File structure: `tools/{toolname}.ts`
   - System prompts: `systemprompts/{toolname}-prompt.ts`

2. **Type Definition Patterns**
   - All extend `ToolRequest` base interface
   - Common fields across all tools:
     - `temperature?: number`
     - `thinking_mode?: 'minimal' | 'low' | 'medium' | 'high' | 'max'
     - `use_websearch?: boolean` 
     - `continuation_id?: string`
   - Consistent enum patterns for review_type, severity_filter, etc.

3. **Implementation Approach**
   - All extend `BaseTool` abstract class
   - Consistent method structure:
     - `getInputSchema()`
     - `getSystemPrompt()`
     - `execute()`
     - Private helper methods for prompt preparation
   - All use zod for validation

4. **Temperature Configuration**
   - Creative tools (ThinkDeep): 0.7
   - Analytical tools (CodeReview, Debug, Analyze, Precommit, TestGen): 0.2

### ⚠️ Issues Requiring Attention

1. **Missing Model Category**
   - **Issue**: CodeReview tool plan doesn't specify a model category
   - **Fix**: Add `modelCategory = ToolModelCategory.REASONING` to CodeReview

2. **Shared Utilities Needed**
   Multiple tools implement similar functionality that should be extracted:
   - **Prompt size validation**: All tools check prompt size
   - **File processing**: Token-aware file content preparation
   - **Clarification requests**: JSON formatting for missing info
   - **Response formatting**: Common patterns for adding next steps

3. **Naming Inconsistency**
   - Debug tool uses `DebugRequest` instead of `DebugIssueRequest`
   - Recommendation: Keep the simplified version

### 📁 Shared Dependencies Identified

1. **Configuration Constants** (`config.ts`)
   - `TEMPERATURE_CREATIVE` (0.7)
   - `TEMPERATURE_ANALYTICAL` (0.2)
   - `DEFAULT_THINKING_MODE_THINKDEEP` ('high')
   - `MCP_PROMPT_SIZE_LIMIT`

2. **Git Utilities** (`utils/git-utils.ts`)
   - Required by Precommit tool
   - Functions: `findGitRepositories`, `getGitStatus`, `runGitCommand`

3. **Common Patterns**
   - All tools support file path lists
   - Most tools have specialized output formats
   - Several tools support clarification requests

## Migration Order Recommendation

Based on dependencies and complexity:

### Phase 1: Foundation (Sequential)
1. Update type definitions with all tool interfaces
2. Implement missing config constants
3. Create shared utility modules

### Phase 2: Simple Tools (Parallel)
- **ThinkDeep**: No special dependencies
- **Analyze**: No special dependencies  
- **CodeReview**: No special dependencies

### Phase 3: Complex Tools (Parallel)
- **Debug**: Handles large diagnostic files
- **TestGen**: Complex test example processing

### Phase 4: Git Integration (Sequential)
1. Implement git utilities
2. Implement **Precommit** tool

## Action Items Before Implementation

1. **Update CodeReview Plan**
   - Add `modelCategory = ToolModelCategory.REASONING`

2. **Create Shared Utilities**
   ```typescript
   // utils/tool-helpers.ts
   export function formatClarificationRequest(question: string, filesNeeded: string[]): string
   export function checkPromptSize(prompt: string, limit: number): ToolOutput | null
   export function formatResponseWithNextSteps(response: string, nextSteps: string): string
   ```

3. **Define Base Request Interface**
   ```typescript
   // types/tools.d.ts
   export interface BaseToolRequest {
     model?: string;
     temperature?: number;
     thinking_mode?: ThinkingMode;
     use_websearch?: boolean;
     continuation_id?: string;
   }
   ```

4. **Update Type Definitions**
   - Add all tool-specific request interfaces
   - Add special status types (TestGenerationStatus, etc.)

## Positive Observations

1. **Consistent Error Handling**: All tools plan for graceful error handling
2. **Token Awareness**: Multiple tools consider token limits
3. **Extensibility**: Clean separation allows easy addition of new tools
4. **Type Safety**: Strong typing throughout with TypeScript
5. **Documentation**: Each tool has comprehensive descriptions

## Conclusion

The migration plans show excellent consistency with only minor issues to address. The shared patterns and common approaches will result in a maintainable, cohesive codebase. With the recommended adjustments, the implementation can proceed smoothly.