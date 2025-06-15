# ThinkDeep Tool Migration Plan

## Overview
The ThinkDeep tool is an extended reasoning and problem-solving tool that provides deep analysis for complex problems. It acts as a senior engineering collaborator to deepen, validate, and extend Claude's thinking on architecture decisions, complex bugs, performance challenges, and security analysis.

## Python Implementation Analysis

### Core Components

1. **Request Model** (`ThinkDeepRequest`)
   - `prompt`: Required string containing current thinking/analysis
   - `problem_context`: Optional additional context
   - `focus_areas`: Optional list of specific aspects (architecture, performance, security, etc.)
   - `files`: Optional list of file paths for additional context
   - `temperature`: Optional creative thinking temperature (0-1, default 0.7)
   - `thinking_mode`: Optional depth level (minimal/low/medium/high/max)
   - `use_websearch`: Optional boolean (default True)
   - `continuation_id`: Optional thread continuation ID

2. **ThinkDeepTool Class**
   - Extends `BaseTool`
   - Name: "thinkdeep"
   - Model category: `EXTENDED_REASONING`
   - Default temperature: `TEMPERATURE_CREATIVE` (0.7)
   - Default thinking mode: Configurable via `DEFAULT_THINKING_MODE_THINKDEEP` (defaults to 'high')

3. **Key Features**
   - Prompt size validation (checks against MCP_PROMPT_SIZE_LIMIT)
   - Special handling for `prompt.txt` files in the files array
   - Clarification request support via JSON response
   - Web search instruction generation
   - Critical evaluation prompt appended to responses

4. **System Prompt**
   - Defines role as senior engineering collaborator
   - Includes clarification mechanism for requesting additional files
   - Focus areas: architecture, performance, security, quality, integration
   - Emphasizes practical, implementable suggestions

## Node.js Implementation Plan

### 1. Type Definitions (`types/tools.d.ts`)
```typescript
export interface ThinkDeepRequest extends ToolRequest {
  prompt: string;
  problem_context?: string;
  focus_areas?: string[];
  files?: string[];
  temperature?: number;
  thinking_mode?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  use_websearch?: boolean;
  continuation_id?: string;
}
```

### 2. System Prompt (`systemprompts/thinkdeep-prompt.ts`)
- Create a new file to store the thinkdeep system prompt
- Export as a constant string

### 3. ThinkDeepTool Class (`tools/thinkdeep.ts`)
```typescript
import { BaseTool } from './base.js';
import { ThinkDeepRequest, ToolOutput, ToolModelCategory } from '../types/tools.js';
import { THINKDEEP_PROMPT } from '../systemprompts/thinkdeep-prompt.js';
import { TEMPERATURE_CREATIVE, DEFAULT_THINKING_MODE_THINKDEEP } from '../config.js';

export class ThinkDeepTool extends BaseTool {
  name = 'thinkdeep';
  description = 'EXTENDED THINKING & REASONING - Your deep thinking partner...';
  defaultTemperature = TEMPERATURE_CREATIVE;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema() {
    // Return JSON schema with all fields
  }
  
  getSystemPrompt() {
    return THINKDEEP_PROMPT;
  }
  
  async execute(args: ThinkDeepRequest): Promise<ToolOutput> {
    // 1. Validate request using zod schema
    // 2. Check prompt size
    // 3. Handle prompt.txt file if present
    // 4. Prepare full prompt with context
    // 5. Select appropriate model
    // 6. Make API call via provider
    // 7. Format response with critical evaluation
    // 8. Handle conversation threading
  }
  
  private preparePrompt(request: ThinkDeepRequest): string {
    // Build context with current analysis, problem context, files, focus areas
  }
  
  private formatResponse(response: string, modelInfo?: any): string {
    // Add critical evaluation prompt
  }
}
```

### 4. Configuration Updates
- Add `TEMPERATURE_CREATIVE` (0.7) to config.ts
- Add `DEFAULT_THINKING_MODE_THINKDEEP` ('high') to config.ts

### 5. Integration Steps
1. Update `index.ts` to import and register ThinkDeepTool
2. Add ThinkDeepRequest to tool types export
3. Ensure model selection logic supports EXTENDED_REASONING category

### 6. Testing Requirements
- Unit tests for prompt preparation logic
- Tests for prompt size validation
- Tests for prompt.txt file handling
- Tests for clarification request format
- Integration tests with mock providers

### 7. Special Considerations
- **Prompt Size Handling**: Must validate against MCP protocol limits and provide helpful error messages
- **File Processing**: Handle prompt.txt specially - if present in files array, use its content as the main prompt
- **Clarification Requests**: Support the specific JSON format for requesting additional information
- **Model Selection**: Prefer reasoning-capable models (pro, o3, etc.) for extended thinking tasks
- **Response Formatting**: Always append critical evaluation instructions to guide Claude's review

### 8. Dependencies
- No new npm packages required
- Uses existing zod validation
- Leverages base tool functionality
- Integrates with existing provider system

### 9. Migration Order
This tool should be implemented after the base infrastructure is stable but can be done in parallel with other tools since it doesn't have dependencies on them.