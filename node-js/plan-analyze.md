# Analyze Tool Migration Plan

## Overview
The Analyze tool provides general-purpose file and code analysis for understanding codebases at a strategic level. Unlike the CodeReview tool which focuses on bugs and issues, Analyze performs holistic technical audits examining architecture, scalability, maintainability, and strategic improvement opportunities.

## Python Implementation Analysis

### Core Components

1. **Request Model** (`AnalyzeRequest`)
   - `files`: Required list of files or directories to analyze (absolute paths)
   - `prompt`: Required string describing what to analyze or look for
   - `analysis_type`: Optional type ('architecture'|'performance'|'security'|'quality'|'general')
   - `output_format`: Optional format ('summary'|'detailed'|'actionable'), defaults to 'detailed'
   - `temperature`: Optional number (0-1), defaults to 0.2
   - `thinking_mode`: Optional ('minimal'|'low'|'medium'|'high'|'max')
   - `use_websearch`: Optional boolean, defaults to True
   - `continuation_id`: Optional thread continuation ID

2. **AnalyzeTool Class**
   - Extends `BaseTool`
   - Name: "analyze"
   - Model category: `EXTENDED_REASONING`
   - Default temperature: `TEMPERATURE_ANALYTICAL` (0.2)

3. **Key Features**
   - General-purpose analysis for codebase exploration
   - Strategic focus on architecture and long-term implications
   - Multiple analysis types for different focus areas
   - Configurable output formats
   - Escalation to CodeReview tool when needed
   - Clarification request mechanism

4. **System Prompt**
   - Senior software analyst performing holistic technical audit
   - Focus on strategic insights vs line-by-line issues
   - Key dimensions: architecture, scalability, maintainability, security, operations
   - Structured output with executive overview and strategic findings
   - Effort vs benefit analysis for recommendations

## Node.js Implementation Plan

### 1. Type Definitions (`types/tools.d.ts`)
```typescript
export interface AnalyzeRequest extends ToolRequest {
  files: string[];
  prompt: string;
  analysis_type?: 'architecture' | 'performance' | 'security' | 'quality' | 'general';
  output_format?: 'summary' | 'detailed' | 'actionable';
  temperature?: number;
  thinking_mode?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  use_websearch?: boolean;
  continuation_id?: string;
}
```

### 2. System Prompt (`systemprompts/analyze-prompt.ts`)
- Create a new file to store the analyze system prompt
- Export as a constant string
- Include escalation mechanism to CodeReview

### 3. AnalyzeTool Class (`tools/analyze.ts`)
```typescript
import { BaseTool } from './base.js';
import { AnalyzeRequest, ToolOutput, ToolModelCategory } from '../types/tools.js';
import { ANALYZE_PROMPT } from '../systemprompts/analyze-prompt.js';
import { TEMPERATURE_ANALYTICAL } from '../config.js';

export class AnalyzeTool extends BaseTool {
  name = 'analyze';
  description = 'ANALYZE FILES & CODE - General-purpose analysis...';
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema() {
    // Return JSON schema with all fields
    // Include enum values for analysis_type and output_format
  }
  
  getSystemPrompt() {
    return ANALYZE_PROMPT;
  }
  
  async execute(args: AnalyzeRequest): Promise<ToolOutput> {
    // 1. Validate request using zod schema
    // 2. Check prompt size
    // 3. Handle prompt.txt file if present
    // 4. Prepare analysis prompt
    // 5. Select appropriate model
    // 6. Make API call via provider
    // 7. Format response with next steps
    // 8. Handle conversation threading
  }
  
  private preparePrompt(request: AnalyzeRequest): string {
    // Build analysis focus based on type and format
    // Include files content
    // Add web search instructions
  }
  
  private formatResponse(response: string, request: AnalyzeRequest): string {
    // Add next steps guidance
  }
}
```

### 4. Configuration Updates
- Ensure `TEMPERATURE_ANALYTICAL` (0.2) is in config.ts

### 5. Integration Steps
1. Update `index.ts` to import and register AnalyzeTool
2. Add AnalyzeRequest to tool types export
3. Ensure model selection supports EXTENDED_REASONING category

### 6. Testing Requirements
- Unit tests for different analysis types
- Tests for output format variations
- Tests for prompt.txt handling
- Tests for clarification requests
- Tests for escalation to codereview
- Integration tests with directories

### 7. Special Considerations
- **Strategic vs Tactical**: This tool focuses on system-level insights, not bug hunting
- **Analysis Type Focus**:
  - `architecture`: Patterns, structure, design decisions
  - `performance`: Characteristics and optimization opportunities
  - `security`: Systemic exposure points, threat surfaces
  - `quality`: Maintainability, tech debt, best practices
  - `general`: Comprehensive analysis covering all aspects
- **Output Formats**:
  - `summary`: Concise key findings
  - `detailed`: Full analysis with evidence (default)
  - `actionable`: Focus on specific recommendations
- **Escalation Logic**: Can suggest using CodeReview tool for comprehensive code-wide reviews
- **Next Steps**: Always includes guidance for continuing the task

### 8. Dependencies
- No new npm packages required
- Uses existing zod validation
- Leverages base tool functionality
- Integrates with existing provider system

### 9. Migration Order
This tool can be implemented in parallel with other tools. It complements CodeReview by providing strategic analysis vs tactical bug finding.

### 10. Output Format Example
The tool should produce output in this format:
```
## Executive Overview
The codebase demonstrates solid modular architecture with clear separation of concerns. However, the data layer shows signs of coupling that could impact scalability as the system grows.

## Strategic Findings (Ordered by Impact)

### 1. Data Layer Coupling
**Insight:** Direct database access from multiple services creates tight coupling.
**Evidence:** Services in src/services/*.js directly import database models.
**Impact:** Limits ability to scale services independently or change data storage.
**Recommendation:** Introduce repository pattern to abstract data access.
**Effort vs. Benefit:** Medium effort; High payoff.

### 2. Missing Observability Layer
**Insight:** Limited logging and no structured metrics collection.
**Evidence:** Only console.log statements found, no APM integration.
**Impact:** Difficult to diagnose production issues or track performance.
**Recommendation:** Implement structured logging with correlation IDs.
**Effort vs. Benefit:** Low effort; High payoff.

## Quick Wins
• Add request correlation IDs to all API endpoints
• Implement basic health check endpoint
• Add environment-specific config validation on startup

## Long-Term Roadmap Suggestions
*Only if requested*

---

**Next Steps:** Use this analysis to actively continue your task. Investigate deeper into any findings, implement solutions based on these insights, and carry out the necessary work.
```