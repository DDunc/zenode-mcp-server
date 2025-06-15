# Precommit Tool Migration Plan

## Overview
The Precommit tool provides comprehensive pre-commit validation for git changes across multiple repositories. It's designed to catch bugs, security issues, and incomplete implementations before code is committed, ensuring changes match original requirements. This tool searches all git repositories recursively and provides deep analysis of staged/unstaged changes.

## Python Implementation Analysis

### Core Components

1. **Request Model** (`PrecommitRequest`)
   - `path`: Required string - starting directory to search for git repositories (absolute path)
   - `prompt`: Optional string - original user request description providing context
   - `compare_to`: Optional string - git ref (branch/tag/commit) to compare against
   - `include_staged`: Optional boolean - include staged changes (default: true)
   - `include_unstaged`: Optional boolean - include unstaged changes (default: true)
   - `focus_on`: Optional string - specific aspects to focus on
   - `review_type`: Optional literal ('full'|'security'|'performance'|'quick'), defaults to 'full'
   - `severity_filter`: Optional literal ('critical'|'high'|'medium'|'all'), defaults to 'all'
   - `max_depth`: Optional integer - max depth for repository search (default: 5)
   - `temperature`: Optional number (0-1)
   - `thinking_mode`: Optional ('minimal'|'low'|'medium'|'high'|'max')
   - `files`: Optional list - additional context files (not part of changes)
   - `use_websearch`: Optional boolean, defaults to True
   - `continuation_id`: Optional thread continuation ID

2. **Precommit Class**
   - Extends `BaseTool`
   - Name: "precommit"
   - Model category: `EXTENDED_REASONING`
   - Default temperature: `TEMPERATURE_ANALYTICAL` (0.2)

3. **Key Features**
   - Recursive git repository discovery
   - Support for both local changes and branch comparisons
   - Separates git diffs from additional context files
   - Token-aware diff truncation
   - Multiple review types and severity filtering
   - Git command execution with proper error handling
   - File path translation for different environments

4. **System Prompt**
   - Expert pre-commit reviewer role
   - Focus on changes in diff only, not broad refactors
   - Severity-based issue prioritization
   - Structured output with repository summaries
   - Emphasis on regression prevention and side effects

## Node.js Implementation Plan

### 1. Type Definitions (`types/tools.d.ts`)
```typescript
export interface PrecommitRequest extends ToolRequest {
  path: string;
  prompt?: string;
  compare_to?: string;
  include_staged?: boolean;
  include_unstaged?: boolean;
  focus_on?: string;
  review_type?: 'full' | 'security' | 'performance' | 'quick';
  severity_filter?: 'critical' | 'high' | 'medium' | 'all';
  max_depth?: number;
  temperature?: number;
  thinking_mode?: 'minimal' | 'low' | 'medium' | 'high' | 'max';
  files?: string[];
  use_websearch?: boolean;
  continuation_id?: string;
}
```

### 2. Git Utilities (`utils/git-utils.ts`)
Create utilities for git operations:
```typescript
export async function findGitRepositories(path: string, maxDepth: number): Promise<string[]>
export async function getGitStatus(repoPath: string): Promise<GitStatus>
export async function runGitCommand(command: string, cwd: string): Promise<GitCommandResult>
export function getGitDiff(repoPath: string, options: DiffOptions): Promise<string>
```

### 3. System Prompt (`systemprompts/precommit-prompt.ts`)
- Create a new file to store the precommit system prompt
- Export as a constant string
- Include severity definitions and output format

### 4. PrecommitTool Class (`tools/precommit.ts`)
```typescript
import { BaseTool } from './base.js';
import { PrecommitRequest, ToolOutput, ToolModelCategory } from '../types/tools.js';
import { PRECOMMIT_PROMPT } from '../systemprompts/precommit-prompt.js';
import { TEMPERATURE_ANALYTICAL } from '../config.js';
import { findGitRepositories, getGitDiff } from '../utils/git-utils.js';

export class PrecommitTool extends BaseTool {
  name = 'precommit';
  description = 'PRECOMMIT VALIDATION FOR GIT CHANGES...';
  defaultTemperature = TEMPERATURE_ANALYTICAL;
  modelCategory = ToolModelCategory.EXTENDED_REASONING;
  
  getInputSchema() {
    // Return JSON schema with all fields
  }
  
  getSystemPrompt() {
    return PRECOMMIT_PROMPT;
  }
  
  async execute(args: PrecommitRequest): Promise<ToolOutput> {
    // 1. Validate request using zod schema
    // 2. Find git repositories recursively
    // 3. For each repository:
    //    - Get git status
    //    - Generate appropriate diffs
    //    - Handle token limits
    // 4. Prepare prompt with diffs and context
    // 5. Select appropriate model
    // 6. Make API call via provider
    // 7. Format response
    // 8. Handle conversation threading
  }
  
  private async collectGitDiffs(request: PrecommitRequest): Promise<RepositoryDiffs[]> {
    // Find repositories
    // Generate diffs based on compare_to or staged/unstaged
    // Handle token limits per diff
  }
  
  private preparePrompt(request: PrecommitRequest, diffs: RepositoryDiffs[]): string {
    // Build prompt with user context
    // Add git diffs section
    // Add additional context files if provided
  }
}
```

### 5. Configuration Updates
- Ensure `TEMPERATURE_ANALYTICAL` (0.2) is in config.ts
- Add constants for default token limits

### 6. Integration Steps
1. Update `index.ts` to import and register PrecommitTool
2. Add PrecommitRequest to tool types export
3. Implement git utilities for repository discovery and diff generation
4. Ensure proper error handling for git operations

### 7. Testing Requirements
- Unit tests for git repository discovery
- Tests for different diff scenarios (staged, unstaged, compare_to)
- Tests for token limit handling
- Tests for multiple repository handling
- Tests for file path translation
- Integration tests with actual git repositories
- Tests for clarification requests

### 8. Special Considerations
- **Git Operations**: Need to handle various git states gracefully:
  - Repositories with no changes
  - Repositories with conflicts
  - Repositories with binary files
  - Nested git repositories
- **Token Management**: Must handle large diffs intelligently:
  - Truncate individual file diffs if too large
  - Prioritize showing changes over context
  - Provide summaries for truncated content
- **Path Translation**: Support for different environments (Docker, WSL, etc.)
- **Review Types**:
  - `full`: Comprehensive review of all aspects
  - `security`: Focus on security vulnerabilities
  - `performance`: Focus on performance issues
  - `quick`: High-level review for major issues
- **Output Structure**: Maintain consistent format with repository summaries and severity-based grouping

### 9. Dependencies
- May need a git command execution library or use Node.js child_process
- No other new npm packages required
- Uses existing zod validation
- Leverages base tool functionality

### 10. Migration Order
This tool has more complex dependencies (git utilities) and should be implemented after the simpler tools. It's a good candidate for later in the migration process.

### 11. Output Format Example
The tool should produce output in this format:
```
### Repository Summary
**Repository:** /Users/dev/project/backend
- Files changed: 3
- Overall assessment: 1 critical issue, 2 high priority fixes needed

### Issues by Severity
[CRITICAL] SQL Injection Vulnerability
- File: src/api/users.js:45
- Description: User input directly concatenated into SQL query
- Fix: Use parameterized queries: db.query('SELECT * FROM users WHERE id = ?', [userId])

[HIGH] Missing Error Handling
- File: src/services/payment.js:78
- Description: Async operation without try-catch could crash server
- Fix: Wrap in try-catch block and return appropriate error response

### Recommendations
- Top priority fixes before commit:
  1. Fix SQL injection vulnerability immediately
  2. Add error handling to payment service
- Notable positives to keep:
  - Good use of async/await patterns
  - Clear function naming conventions
```