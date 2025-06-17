/**
 * File system utilities with security and path translation
 */

import fs from 'fs/promises';
import path from 'path';
import { constants } from 'fs';
import { MCP_WORKSPACE } from '../config.js';
import { logger } from './logger.js';

/**
 * Translate a file path for the current environment
 * Handles Docker vs local development path differences
 */
export function translatePathForEnvironment(filePath: string): string {
  // If path is already absolute and exists, return it
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  // Handle workspace-relative paths
  if (filePath.startsWith('~/') || filePath.startsWith('./')) {
    const relativePath = filePath.startsWith('~/') ? filePath.slice(2) : filePath.slice(2);
    return path.join(MCP_WORKSPACE, relativePath);
  }

  // Assume relative to workspace
  return path.join(MCP_WORKSPACE, filePath);
}

/**
 * Check if a path is safe (within workspace)
 */
export function isPathSafe(filePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  const workspacePath = path.resolve(MCP_WORKSPACE);
  
  // Check if the resolved path is within the workspace
  return resolvedPath.startsWith(workspacePath);
}

/**
 * Read a file with security checks
 */
export async function readFile(filePath: string): Promise<string> {
  const translatedPath = translatePathForEnvironment(filePath);
  
  // Debug logging
  logger.debug(`File access attempt: ${filePath}`);
  logger.debug(`Translated path: ${translatedPath}`);
  logger.debug(`MCP_WORKSPACE: ${MCP_WORKSPACE}`);
  
  // Security check
  if (!isPathSafe(translatedPath)) {
    logger.error(`Path security check failed: ${filePath} -> ${translatedPath} (workspace: ${MCP_WORKSPACE})`);
    throw new Error(`Access denied: Path outside workspace: ${filePath}`);
  }

  try {
    // Check if file exists and is readable
    await fs.access(translatedPath, constants.R_OK);
    
    // Read the file
    const content = await fs.readFile(translatedPath, 'utf-8');
    return content;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    }
    if ((error as any).code === 'EACCES') {
      throw new Error(`Permission denied: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Read multiple files
 */
export async function readFiles(filePaths: string[]): Promise<Record<string, string>> {
  const results: Record<string, string> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        results[filePath] = await readFile(filePath);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors[filePath] = errorMsg;
        logger.warn(`Failed to read file ${filePath}: ${errorMsg}`);
      }
    }),
  );

  // If all files failed, throw an error
  if (Object.keys(errors).length === filePaths.length) {
    throw new Error(`Failed to read any files: ${JSON.stringify(errors)}`);
  }

  // Add error messages for failed files
  for (const [filePath, error] of Object.entries(errors)) {
    results[filePath] = `[Error reading file: ${error}]`;
  }

  return results;
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  const translatedPath = translatePathForEnvironment(filePath);
  
  try {
    await fs.access(translatedPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file stats
 */
export async function getFileStats(filePath: string) {
  const translatedPath = translatePathForEnvironment(filePath);
  
  if (!isPathSafe(translatedPath)) {
    throw new Error(`Access denied: Path outside workspace: ${filePath}`);
  }

  return await fs.stat(translatedPath);
}

/**
 * List files in a directory
 */
export async function listDirectory(dirPath: string): Promise<string[]> {
  const translatedPath = translatePathForEnvironment(dirPath);
  
  if (!isPathSafe(translatedPath)) {
    throw new Error(`Access denied: Path outside workspace: ${dirPath}`);
  }

  try {
    const entries = await fs.readdir(translatedPath);
    return entries;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    if ((error as any).code === 'ENOTDIR') {
      throw new Error(`Not a directory: ${dirPath}`);
    }
    throw error;
  }
}

/**
 * Read directory recursively with file type filtering
 */
export async function readDirectoryRecursive(
  dirPath: string,
  options: {
    maxDepth?: number;
    includePatterns?: RegExp[];
    excludePatterns?: RegExp[];
    maxFiles?: number;
  } = {},
): Promise<string[]> {
  const {
    maxDepth = 10,
    includePatterns = [],
    excludePatterns = [/node_modules/, /\.git/, /dist/, /coverage/],
    maxFiles = 1000,
  } = options;

  const translatedPath = translatePathForEnvironment(dirPath);
  
  if (!isPathSafe(translatedPath)) {
    throw new Error(`Access denied: Path outside workspace: ${dirPath}`);
  }

  const files: string[] = [];
  const visited = new Set<string>();

  async function traverse(currentPath: string, depth: number) {
    if (depth > maxDepth || files.length >= maxFiles) {
      return;
    }

    // Avoid infinite loops with symlinks
    const realPath = await fs.realpath(currentPath);
    if (visited.has(realPath)) {
      return;
    }
    visited.add(realPath);

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(translatedPath, fullPath);

      // Check exclusion patterns
      if (excludePatterns.some((pattern) => pattern.test(relativePath))) {
        continue;
      }

      if (entry.isDirectory()) {
        await traverse(fullPath, depth + 1);
      } else if (entry.isFile()) {
        // Check inclusion patterns
        if (includePatterns.length === 0 || includePatterns.some((pattern) => pattern.test(relativePath))) {
          files.push(relativePath);
          
          if (files.length >= maxFiles) {
            logger.warn(`Reached maximum file limit (${maxFiles}) while reading directory`);
            return;
          }
        }
      }
    }
  }

  await traverse(translatedPath, 0);
  return files;
}

/**
 * Get file extension
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Check if file is text-based (can be read as string)
 */
export function isTextFile(filePath: string): boolean {
  const ext = getFileExtension(filePath);
  const textExtensions = [
    '.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.txt', '.yaml', '.yml',
    '.css', '.scss', '.html', '.xml', '.csv', '.log', '.sh', '.bash',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb',
    '.php', '.swift', '.kt', '.scala', '.r', '.m', '.sql', '.graphql',
    '.env', '.gitignore', '.dockerignore', '.editorconfig', '.prettierrc',
  ];
  
  return textExtensions.includes(ext) || filePath.includes('.');
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Estimate tokens for a file using file-type aware ratios.
 * 
 * This uses sophisticated heuristics based on file type to provide accurate
 * token estimates without actually tokenizing the content.
 */
export async function estimateFileTokens(filePath: string): Promise<number> {
  try {
    const translatedPath = translatePathForEnvironment(filePath);
    const stats = await getFileStats(filePath);
    const sizeInBytes = stats.size;
    
    // Get file extension for type-specific estimation
    const ext = getFileExtension(filePath).toLowerCase();
    
    // Type-specific token ratios (characters per token)
    let charsPerToken = 4; // Default for general text
    
    // Code files tend to be more token-dense due to syntax
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.go', '.rs', '.rb', '.php'];
    if (codeExtensions.includes(ext)) {
      charsPerToken = 3.5; // Code is more token-dense
    }
    
    // JSON and structured data
    const dataExtensions = ['.json', '.yaml', '.yml', '.xml', '.csv'];
    if (dataExtensions.includes(ext)) {
      charsPerToken = 4.5; // Structured data is less token-dense
    }
    
    // Documentation and markdown
    const docExtensions = ['.md', '.txt', '.rst'];
    if (docExtensions.includes(ext)) {
      charsPerToken = 4.2; // Natural language
    }
    
    // Estimate assuming UTF-8 (most files are roughly 1 byte per character for typical code)
    const estimatedChars = sizeInBytes;
    const estimatedTokens = Math.ceil(estimatedChars / charsPerToken);
    
    logger.debug(`[TOKEN_ESTIMATE] ${filePath}: ${sizeInBytes} bytes → ~${estimatedTokens} tokens (${charsPerToken} chars/token)`);
    
    return estimatedTokens;
  } catch (error) {
    logger.warn(`Failed to estimate tokens for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return 1000; // Conservative fallback estimate
  }
}

/**
 * Check if total file sizes would exceed token threshold before embedding.
 *
 * IMPORTANT: This performs STRICT REJECTION at MCP boundary.
 * No partial inclusion - either all files fit or request is rejected.
 * This forces Claude to make better file selection decisions.
 */
export async function checkTotalFileSize(files: string[], modelName: string): Promise<{
  status: 'MCP_CODE_TOO_LARGE';
  content: string;
  content_type: 'text';
} | null> {
  if (!files || files.length === 0) {
    return null;
  }

  // Import model context utilities for token limits
  const { ModelContext } = await import('./model-context.js');
  const modelContext = new ModelContext(modelName);
  const allocation = await modelContext.calculateTokenAllocation();
  const maxFileTokens = allocation.fileTokens || Math.floor(allocation.contentTokens * 0.7);

  let totalEstimatedTokens = 0;
  const fileEstimates: Array<{ path: string; tokens: number; size: number }> = [];

  // Estimate tokens for all files
  for (const filePath of files) {
    try {
      const estimatedTokens = await estimateFileTokens(filePath);
      const stats = await getFileStats(filePath);
      
      fileEstimates.push({
        path: filePath,
        tokens: estimatedTokens,
        size: stats.size,
      });
      
      totalEstimatedTokens += estimatedTokens;
    } catch (error) {
      logger.warn(`Failed to estimate size for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Add conservative estimate for inaccessible files
      totalEstimatedTokens += 1000;
      fileEstimates.push({
        path: filePath,
        tokens: 1000,
        size: 0,
      });
    }
  }

  // Check if total would exceed limit
  if (totalEstimatedTokens > maxFileTokens) {
    const filesBreakdown = fileEstimates
      .sort((a, b) => b.tokens - a.tokens) // Sort by token count, largest first
      .map(f => `  • ${f.path}: ~${f.tokens.toLocaleString()} tokens (${formatFileSize(f.size)})`)
      .join('\n');

    const errorMessage = [
      'MCP_CODE_TOO_LARGE: The requested files exceed the model\'s context limit and cannot be processed together.',
      '',
      `Total estimated tokens: ${totalEstimatedTokens.toLocaleString()}`,
      `Model limit for files: ${maxFileTokens.toLocaleString()} tokens`,
      `Model: ${modelName}`,
      '',
      'Files requested (sorted by size):',
      filesBreakdown,
      '',
      'SOLUTION: Please reduce the number of files or select smaller files.',
      'Consider analyzing files individually or in smaller groups.',
      'Focus on the most relevant files for your specific question.',
    ].join('\n');

    logger.info(`[MCP_BOUNDARY] Rejecting request - ${files.length} files would use ${totalEstimatedTokens.toLocaleString()} tokens (limit: ${maxFileTokens.toLocaleString()})`);

    return {
      status: 'MCP_CODE_TOO_LARGE',
      content: errorMessage,
      content_type: 'text',
    };
  }

  logger.debug(`[MCP_BOUNDARY] File size check passed - ${files.length} files estimated at ${totalEstimatedTokens.toLocaleString()} tokens (limit: ${maxFileTokens.toLocaleString()})`);
  return null;
}

/**
 * Read file content with formatting and token estimation
 * 
 * Returns formatted content suitable for embedding in conversation history
 * along with accurate token count for budget tracking.
 */
export async function readFileContent(filePath: string): Promise<{ content: string; tokens: number }> {
  try {
    const content = await readFile(filePath);
    
    if (!content || content.trim().length === 0) {
      return { content: '', tokens: 0 };
    }

    // Format content with line numbers and header
    const lines = content.split('\n');
    const maxLineNumberWidth = lines.length.toString().length;
    
    const formattedLines = lines.map((line, index) => {
      const lineNumber = (index + 1).toString().padStart(maxLineNumberWidth, ' ');
      return `${lineNumber}→${line}`;
    });

    const formattedContent = [
      `--- File: ${filePath} ---`,
      ...formattedLines,
      `--- End of ${filePath} ---`,
      ''
    ].join('\n');

    // Estimate tokens for the formatted content
    const estimatedTokens = Math.ceil(formattedContent.length / 4); // Rough estimate: 4 chars per token

    return {
      content: formattedContent,
      tokens: estimatedTokens,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const errorContent = `--- File: ${filePath} (Error) ---\n[Error reading file: ${errorMsg}]\n--- End of ${filePath} ---\n`;
    
    return {
      content: errorContent,
      tokens: Math.ceil(errorContent.length / 4),
    };
  }
}