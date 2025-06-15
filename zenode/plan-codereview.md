# CodeReview Tool Migration Plan

## Overview
The CodeReview tool provides professional-grade code review capabilities with comprehensive analysis for bugs, security vulnerabilities, performance issues, and code quality problems. It supports both individual files and entire directories/projects, offering severity-based issue categorization and specific remediation steps.

## Python Implementation Analysis

### Core Components

1. **Request Model** (`CodeReviewRequest`)
   - `files`: Required list of code files or directories to review (absolute paths)
   - `prompt`: Required string with user's summary of code purpose, expected behavior, constraints, and review objectives
   - `review_type`: Optional string ('full'|'security'|'performance'|'quick'), defaults to 'full'
   - `focus_on`: Optional string for specific aspects to focus on
   - `standards`: Optional string for coding standards/guidelines to enforce
   - `severity_filter`: Optional string ('critical'|'high'|'medium'|'all'), defaults to 'all'
   - `temperature`: Optional number (0-1), defaults to 0.2
   - `thinking_mode`: Optional ('minimal'|'low'|'medium'|'high'|'max')
   - `use_websearch`: Optional boolean, defaults to True
   - `continuation_id`: Optional thread continuation ID

2. **CodeReviewTool Class**
   - Extends `BaseTool`
   - Name: "codereview"
   - Model category: Not explicitly set (uses base default)
   - Default temperature: `TEMPERATURE_ANALYTICAL` (0.2)

3. **Key Features**
   - Multi-file and directory support
   - Configurable review types for focused analysis
   - Severity-based issue filtering and reporting
   - Custom focus areas and coding standards support
   - Structured output format with specific fix recommendations
   - Clarification request mechanism for missing context
   - Focus scope validation to prevent overly broad reviews

4. **System Prompt**
   - Expert code reviewer role with security, performance, maintainability expertise
   - Severity definitions: Critical (🔴), High (🟠), Medium (🟡), Low (🟢)
   - Evaluation areas: security, performance, code quality, testing, dependencies, architecture, operations
   - Structured output format with issue severity, location, and specific fixes
   - Includes summary, top 3 priorities, and positive aspects

## Node.js Implementation Plan

### 1. Type Definitions (`types/tools.d.ts`)
```typescript
export interface CodeReviewRequest extends ToolRequest {
  files: string[];
  prompt: string;
  review_type?: 'full' | 'security' | 'performance' | 'quick';
  focus_on?: string;
  standards?: string;
  severity_filter?: 'critical' | 'high' | 'medium' | 'all';
  temperature?: number;
  thinking_mode?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  use_websearch?: boolean;
  continuation_id?: string;
}
```

### 2. System Prompt (`systemprompts/codereview-prompt.ts`)
- Create a new file to store the codereview system prompt
- Export as a constant string
- Include severity definitions and evaluation areas

### 3. CodeReviewTool Class (`tools/codereview.ts`)
```typescript
import { BaseTool } from './base.js';
import { CodeReviewRequest, ToolOutput } from '../types/tools.js';
import { CODEREVIEW_PROMPT } from '../systemprompts/codereview-prompt.js';
import { TEMPERATURE_ANALYTICAL } from '../config.js';

export class CodeReviewTool extends BaseTool {
  name = 'codereview';
  description = 'PROFESSIONAL CODE REVIEW - Comprehensive analysis for bugs...';
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.REASONING; // Add appropriate category
  
  getInputSchema() {
    // Return JSON schema with all fields
    // Include enum values for review_type and severity_filter
  }
  
  getSystemPrompt() {
    return CODEREVIEW_PROMPT;
  }
  
  async execute(args: CodeReviewRequest): Promise<ToolOutput> {
    // 1. Validate request using zod schema
    // 2. Check focus_on size if provided
    // 3. Handle prompt.txt file if present
    // 4. Prepare full prompt with review instructions
    // 5. Select appropriate model
    // 6. Make API call via provider
    // 7. Format response
    // 8. Handle conversation threading
  }
  
  private preparePrompt(request: CodeReviewRequest): string {
    // Build review instructions based on review_type
    // Add files content with proper formatting
    // Include focus areas and standards if provided
  }
  
  private buildReviewInstructions(request: CodeReviewRequest): string {
    // Customize instructions based on review type
    // Add severity filter instructions
    // Include custom standards if provided
  }
}
```

### 4. Configuration Updates
- Add `TEMPERATURE_ANALYTICAL` (0.2) to config.ts

### 5. Integration Steps
1. Update `index.ts` to import and register CodeReviewTool
2. Add CodeReviewRequest to tool types export
3. Ensure model selection logic supports analytical/reasoning tasks

### 6. Testing Requirements
- Unit tests for different review types
- Tests for severity filtering
- Tests for multi-file handling
- Tests for focus_on size validation
- Tests for clarification request format
- Integration tests with mock providers

### 7. Special Considerations
- **Review Type Logic**: Different review types should customize the prompt instructions
  - `full`: Comprehensive review of all aspects
  - `security`: Focus on authentication, validation, crypto, data handling
  - `performance`: Focus on algorithms, resource usage, concurrency
  - `quick`: High-level review for major issues only
- **Severity Filtering**: Only report issues at or above the specified severity level
- **File Processing**: Support both individual files and directories (recursive)
- **Output Format**: Maintain structured format with severity indicators and specific fixes
- **Scope Management**: Handle "focused_review_required" responses for overly large codebases

### 8. Dependencies
- No new npm packages required
- Uses existing zod validation
- Leverages base tool functionality
- Integrates with existing provider system

### 9. Migration Order
This tool can be implemented in parallel with other tools. It's a good candidate for early implementation as it demonstrates file handling and structured output patterns that other tools may use.

### 10. Output Format Example
The tool should produce output in this format:
```
🔴 CRITICAL: auth.js:45 – SQL injection vulnerability in user login
→ Fix: Use parameterized queries instead of string concatenation

🟠 HIGH: api.js:120 – Missing rate limiting on public endpoint
→ Fix: Implement rate limiting middleware with redis

• Overall code quality summary: The codebase shows good structure...
• Top 3 priority fixes:
  - Fix SQL injection vulnerability in auth.js
  - Add rate limiting to public APIs
  - Implement input validation for user data
• Positive aspects: Clean module separation, good error handling patterns
```