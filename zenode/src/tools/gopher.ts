/**
 * Gopher Tool - Local File System Access Bridge
 *
 * This tool runs locally (not in Docker) and provides file system access
 * to other containerized tools. It acts as a bridge between the sandboxed
 * tools and the local file system that Claude Code can access.
 *
 * Key capabilities:
 * - Read files and directories
 * - Search files with glob patterns
 * - Grep content within files
 * - List directory contents
 * - Translate paths between environments
 */

import { z } from 'zod';
import { promises as fs } from 'fs';
import { join, resolve, isAbsolute, dirname } from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';
import { BaseTool, BaseRequestSchema } from './base.js';
import { ToolOutput } from '../types/tools.js';
import { resolveZenodePath } from '../utils/file-utils.js';

const execAsync = promisify(exec);

/**
 * Gopher tool request schema
 */
const GopherRequestSchema = BaseRequestSchema.extend({
  action: z.enum(['read_file', 'list_directory', 'glob_search', 'grep_search', 'file_exists', 'analyze_code', 'smart_search']),
  path: z.string(),
  pattern: z.string().optional(), // For glob/grep searches
  recursive: z.boolean().default(false), // For directory operations
  include: z.string().optional(), // File pattern filter for grep
  limit: z.number().optional(), // Limit results
  query: z.string().optional(), // AI query for analysis/smart search
});

export class GopherTool extends BaseTool {
  name = 'gopher';
  description = 'LOCAL FILE ACCESS BRIDGE - Provides file system access to containerized tools. ' +
    'Use this tool when you need to read files, list directories, or search content that ' +
    'you cannot directly access from your sandboxed environment. This tool runs locally ' +
    'and has full access to the project files.';

  // Required abstract properties
  defaultTemperature = 0.1; // Not used since this runs locally
  modelCategory: 'fast' | 'reasoning' | 'all' = 'fast'; // Not used

  protected getRequestSchema() {
    return GopherRequestSchema;
  }

  protected getToolCategory(): 'general' | 'analysis' | 'generation' {
    return 'general';
  }

  // Required abstract methods
  getZodSchema() {
    return GopherRequestSchema;
  }

  getSystemPrompt(): string {
    return 'This tool provides local file system access. It does not use AI models.';
  }

  /**
   * Execute gopher action - this runs locally with optional AI analysis
   */
  async execute(request: z.infer<typeof GopherRequestSchema>): Promise<ToolOutput> {
    const { action, path, pattern, recursive, include, limit, query } = request;

    try {
      let result: any;

      switch (action) {
        case 'read_file':
          result = await this.readFile(path);
          break;
        case 'list_directory':
          result = await this.listDirectory(path, recursive);
          break;
        case 'glob_search':
          if (!pattern) throw new Error('Pattern required for glob_search');
          result = await this.globSearch(path, pattern, limit);
          break;
        case 'grep_search':
          if (!pattern) throw new Error('Pattern required for grep_search');
          result = await this.grepSearch(path, pattern, include, limit);
          break;
        case 'file_exists':
          result = await this.fileExists(path);
          break;
        case 'analyze_code':
          if (!query) throw new Error('Query required for analyze_code');
          result = await this.analyzeCode(path, query);
          break;
        case 'smart_search':
          if (!query) throw new Error('Query required for smart_search');
          result = await this.smartSearch(path, query, recursive, limit);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        status: 'success',
        content: this.formatResult(action, result),
        content_type: 'text',
        metadata: {
          action,
          path,
          pattern,
          results_count: Array.isArray(result) ? result.length : 1,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        content: `Gopher tool error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        content_type: 'text',
        metadata: {
          action,
          path,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Read a file's contents
   */
  private async readFile(filePath: string): Promise<string> {
    const resolvedPath = this.resolvePath(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return content;
  }

  /**
   * List directory contents
   */
  private async listDirectory(dirPath: string, recursive: boolean = false): Promise<string[]> {
    const resolvedPath = this.resolvePath(dirPath);
    
    if (recursive) {
      const files = await glob('**/*', { cwd: resolvedPath, dot: true });
      return files.sort();
    } else {
      const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
      return entries.map(entry => {
        const prefix = entry.isDirectory() ? 'd ' : 'f ';
        return `${prefix}${entry.name}`;
      }).sort();
    }
  }

  /**
   * Search files using glob patterns
   */
  private async globSearch(basePath: string, pattern: string, limit?: number): Promise<string[]> {
    const resolvedPath = this.resolvePath(basePath);
    const files = await glob(pattern, { cwd: resolvedPath, absolute: true });
    
    if (limit && files.length > limit) {
      return files.slice(0, limit);
    }
    
    return files;
  }

  /**
   * Search file contents using grep
   */
  private async grepSearch(basePath: string, pattern: string, include?: string, limit?: number): Promise<any[]> {
    const resolvedPath = this.resolvePath(basePath);
    
    // Build ripgrep command
    let cmd = `rg "${pattern}" "${resolvedPath}" --json --no-heading`;
    
    if (include) {
      cmd += ` --type-add 'custom:${include}' --type custom`;
    }
    
    if (limit) {
      cmd += ` --max-count ${limit}`;
    }

    try {
      const { stdout } = await execAsync(cmd);
      const lines = stdout.trim().split('\n').filter(line => line);
      const results = [];
      
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'match') {
            results.push({
              file: parsed.data.path.text,
              line: parsed.data.line_number,
              content: parsed.data.lines.text.trim(),
            });
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
      
      return results;
    } catch (error) {
      // Fallback to basic grep if ripgrep fails
      const cmd = `grep -r "${pattern}" "${resolvedPath}"`;
      try {
        const { stdout } = await execAsync(cmd);
        return stdout.split('\n').filter(line => line).map(line => ({
          match: line
        }));
      } catch (e) {
        return [];
      }
    }
  }

  /**
   * Check if file/directory exists
   */
  private async fileExists(filePath: string): Promise<{ exists: boolean; type?: string }> {
    const resolvedPath = this.resolvePath(filePath);
    
    try {
      const stats = await fs.stat(resolvedPath);
      return {
        exists: true,
        type: stats.isDirectory() ? 'directory' : 'file',
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Resolve path using intelligent zenode path resolution
   * Supports relative paths, absolute paths, and smart workspace detection
   */
  private resolvePath(inputPath: string): string {
    return resolveZenodePath(inputPath);
  }

  /**
   * Format results for display
   */
  private formatResult(action: string, result: any): string {
    switch (action) {
      case 'read_file':
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        
      case 'list_directory':
        if (Array.isArray(result)) {
          return result.join('\n');
        }
        return result.toString();
        
      case 'glob_search':
        if (Array.isArray(result)) {
          return result.join('\n');
        }
        return result.toString();
        
      case 'grep_search':
        if (Array.isArray(result)) {
          return result.map(item => {
            if (item.file && item.line) {
              return `${item.file}:${item.line}: ${item.content}`;
            }
            return item.match || JSON.stringify(item);
          }).join('\n');
        }
        return result.toString();
        
      case 'file_exists':
        return JSON.stringify(result, null, 2);
        
      case 'analyze_code':
      case 'smart_search':
        return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        
      default:
        return JSON.stringify(result, null, 2);
    }
  }

  /**
   * Analyze code using local AI model
   */
  private async analyzeCode(filePath: string, query: string): Promise<string> {
    try {
      // Read the file content
      const content = await this.readFile(filePath);
      
      // Get the local model name
      const modelName = await this.getLocalModel();
      
      // Create analysis prompt
      const prompt = `You are a code analysis assistant. Analyze the following code and answer this question: "${query}"

File: ${filePath}
Code:
\`\`\`
${content}
\`\`\`

Please provide a detailed analysis focusing on the specific question asked.`;

      // Call local Ollama model
      const analysis = await this.callLocalModel(modelName, prompt);
      
      return `## Code Analysis for ${filePath}

**Query:** ${query}

**Analysis:**
${analysis}`;
    } catch (error) {
      return `Error analyzing code: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Smart search using AI to find relevant files based on natural language query
   */
  private async smartSearch(basePath: string, query: string, recursive: boolean = true, limit?: number): Promise<string> {
    try {
      // First, get a list of files
      let files: string[] = [];
      
      if (recursive) {
        const resolvedPath = this.resolvePath(basePath);
        files = await glob('**/*.{js,ts,py,md,json,txt,yml,yaml}', { 
          cwd: resolvedPath, 
          absolute: true 
        });
      } else {
        files = await this.listDirectory(basePath, false);
        files = files.filter(f => f.startsWith('f ')).map(f => f.substring(2));
      }

      if (limit) {
        files = files.slice(0, limit);
      }

      // Get file summaries
      const fileSummaries = [];
      for (const file of files.slice(0, 20)) { // Limit to first 20 files for performance
        try {
          const stats = await fs.stat(file);
          if (stats.size > 100000) continue; // Skip large files
          
          const content = await fs.readFile(file, 'utf-8');
          const preview = content.substring(0, 500) + (content.length > 500 ? '...' : '');
          
          fileSummaries.push({
            path: file,
            size: stats.size,
            preview: preview
          });
        } catch (e) {
          // Skip files we can't read
        }
      }

      // Use AI to analyze and find relevant files
      const modelName = await this.getLocalModel();
      
      const prompt = `You are a file search assistant. Based on the user's query, identify which files are most relevant.

User Query: "${query}"

Available Files:
${fileSummaries.map((f, i) => `${i + 1}. ${f.path}
   Size: ${f.size} bytes
   Preview: ${f.preview.replace(/\n/g, ' ').substring(0, 200)}...
`).join('\n')}

Please identify the most relevant files for this query and explain why they match. Format your response as:
- **Relevant Files:**
  - [file path]: [reason why it's relevant]
- **Summary:** [brief explanation of what you found]`;

      const analysis = await this.callLocalModel(modelName, prompt);
      
      return `## Smart Search Results

**Query:** ${query}
**Base Path:** ${basePath}
**Files Analyzed:** ${fileSummaries.length}

${analysis}`;
    } catch (error) {
      return `Error in smart search: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get the local model name
   */
  private async getLocalModel(): Promise<string> {
    try {
      const modelFile = join(process.cwd(), '.local-model');
      const model = await fs.readFile(modelFile, 'utf-8');
      return model.trim();
    } catch (error) {
      // Fallback to default
      return 'qwen2.5:0.5b';
    }
  }

  /**
   * Check if Ollama is available
   */
  private async isOllamaAvailable(): Promise<boolean> {
    try {
      await execAsync('ollama --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Call local Ollama model with graceful degradation
   */
  private async callLocalModel(model: string, prompt: string): Promise<string> {
    const ollamaAvailable = await this.isOllamaAvailable();
    
    if (!ollamaAvailable) {
      return `⚠️  **LOCAL LLM UNAVAILABLE**

The gopher tool is running with limited functionality because Ollama is not installed or not available.

**Current Status:** Basic file operations work, but AI-powered features (analyze_code, smart_search) are disabled.

**To enable full functionality:**
1. Install Ollama: https://ollama.com/download
2. Pull the model: \`ollama pull ${model}\`
3. Restart the zenode server

**Available without AI:** read_file, list_directory, glob_search, grep_search, file_exists`;
    }

    try {
      // Use Ollama CLI to call the model
      const { stdout } = await execAsync(`ollama run "${model}" "${prompt.replace(/"/g, '\\"')}"`);
      return stdout.trim();
    } catch (error) {
      if (error instanceof Error && error.message.includes('model')) {
        return `⚠️  **MODEL NOT AVAILABLE**

The model "${model}" is not available in Ollama.

**To fix this:**
1. Pull the model: \`ollama pull ${model}\`
2. Or try a different model by updating the .local-model file

**Error:** ${error.message}`;
      }
      throw new Error(`Failed to call local model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}