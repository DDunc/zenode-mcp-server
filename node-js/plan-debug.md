# Debug Tool Migration Plan

## Overview
The Debug tool provides expert debugging and root cause analysis for complex issues. It emphasizes the importance of sharing comprehensive diagnostic information (up to 1M tokens) and focuses on identifying the minimal fix required to resolve specific issues without suggesting unrelated improvements.

## Python Implementation Analysis

### Core Components

1. **Request Model** (`DebugIssueRequest`)
   - `prompt`: Required string with error message, symptoms, or issue description
   - `error_context`: Optional stack trace, logs, or additional error context
   - `files`: Optional list of related files or directories (absolute paths)
   - `runtime_info`: Optional environment, versions, or runtime information
   - `previous_attempts`: Optional description of what has been tried already
   - `temperature`: Optional number (0-1), defaults to 0.2
   - `thinking_mode`: Optional ('minimal'|'low'|'medium'|'high'|'max')
   - `use_websearch`: Optional boolean, defaults to True
   - `continuation_id`: Optional thread continuation ID

2. **DebugIssueTool Class**
   - Extends `BaseTool`
   - Name: "debug"
   - Model category: `EXTENDED_REASONING`
   - Default temperature: `TEMPERATURE_ANALYTICAL` (0.2)

3. **Key Features**
   - Handles large diagnostic files (up to 1M tokens)
   - Prompt size validation for both prompt and error_context
   - Special handling for prompt.txt files
   - Structured hypothesis-based debugging approach
   - Focus on minimal fixes without scope creep
   - Regression prevention analysis
   - Clarification request mechanism

4. **System Prompt**
   - Expert debugger role focused on root cause analysis
   - Emphasizes finding minimal fixes for specific issues
   - Structured output with ranked hypotheses
   - Includes regression prevention checks
   - Scope discipline to avoid unrelated improvements

## Node.js Implementation Plan

### 1. Type Definitions (`types/tools.d.ts`)
```typescript
export interface DebugRequest extends ToolRequest {
  prompt: string;
  error_context?: string;
  files?: string[];
  runtime_info?: string;
  previous_attempts?: string;
  temperature?: number;
  thinking_mode?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  use_websearch?: boolean;
  continuation_id?: string;
}
```

### 2. System Prompt (`systemprompts/debug-prompt.ts`)
- Create a new file to store the debug system prompt
- Export as a constant string
- Include hypothesis ranking structure

### 3. DebugTool Class (`tools/debug.ts`)
```typescript
import { BaseTool } from './base.js';
import { DebugRequest, ToolOutput, ToolModelCategory } from '../types/tools.js';
import { DEBUG_PROMPT } from '../systemprompts/debug-prompt.js';
import { TEMPERATURE_ANALYTICAL } from '../config.js';

export class DebugTool extends BaseTool {
  name = 'debug';
  description = 'DEBUG & ROOT CAUSE ANALYSIS - Expert debugging...';
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema() {
    // Return JSON schema with all fields
  }
  
  getSystemPrompt() {
    return DEBUG_PROMPT;
  }
  
  async execute(args: DebugRequest): Promise<ToolOutput> {
    // 1. Validate request using zod schema
    // 2. Check prompt size
    // 3. Check error_context size if provided
    // 4. Handle prompt.txt file if present
    // 5. Prepare debugging prompt
    // 6. Select appropriate model (prefer reasoning models)
    // 7. Make API call via provider
    // 8. Format response
    // 9. Handle conversation threading
  }
  
  private preparePrompt(request: DebugRequest): string {
    // Build sections: issue description, error context, runtime info, previous attempts, files
    // Include web search instructions for error messages
  }
}
```

### 4. Configuration Updates
- Ensure `TEMPERATURE_ANALYTICAL` (0.2) is in config.ts

### 5. Integration Steps
1. Update `index.ts` to import and register DebugTool
2. Add DebugRequest to tool types export
3. Ensure model selection prefers reasoning models for EXTENDED_REASONING category

### 6. Testing Requirements
- Unit tests for prompt size validation (both prompt and error_context)
- Tests for prompt.txt handling logic
- Tests for hypothesis ranking output format
- Tests for clarification requests
- Integration tests with large diagnostic files
- Tests for regression prevention analysis

### 7. Special Considerations
- **Large Context Handling**: The tool advertises 1M token capacity - ensure provider limits are respected
- **Prompt.txt Logic**: If prompt.txt is found in files:
  - If prompt is empty, use prompt.txt content as prompt
  - Otherwise, use prompt.txt content as error_context
- **Hypothesis Ranking**: Output should include confidence levels (High/Medium/Low)
- **Minimal Fix Focus**: Avoid suggesting refactoring or unrelated improvements
- **Web Search**: Particularly useful for:
  - Exact error messages
  - Framework-specific error codes
  - Known issues in forums/GitHub
  - Version-specific problems

### 8. Dependencies
- No new npm packages required
- Uses existing zod validation
- Leverages base tool functionality
- Integrates with existing provider system

### 9. Migration Order
This tool should be implemented after the base infrastructure is stable. It can be done in parallel with other tools but benefits from having the extended reasoning model selection logic in place.

### 10. Output Format Example
The tool should produce output in this format:
```
## Summary
The application crashes when processing large CSV files due to memory exhaustion.

## Hypotheses (Ranked by Likelihood)

### 1. Unbounded Memory Allocation (Confidence: High)
**Root Cause:** The CSV parser loads entire file into memory without streaming.
**Evidence:** OOM error occurs at line 145 in csv-parser.js
**Correlation:** Crash only happens with files > 100MB
**Validation:** Monitor memory usage while parsing a large file
**Minimal Fix:** Replace readFileSync with createReadStream and process in chunks
**Regression Check:** Streaming approach maintains same output format

### 2. Memory Leak in Data Processing (Confidence: Low)
**Root Cause:** Objects not being garbage collected properly
**Evidence:** Memory grows even with small files over time
**Correlation:** Issue appears after multiple file operations
**Validation:** Run heap profiler during extended usage
**Minimal Fix:** Clear object references after processing
**Regression Check:** No impact on processing logic

## Immediate Actions
1. Add memory usage logging before/after file processing
2. Set --max-old-space-size flag as temporary mitigation

## Prevention Strategy
*Only provided if requested*
```