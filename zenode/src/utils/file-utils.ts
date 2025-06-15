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
  
  // Security check
  if (!isPathSafe(translatedPath)) {
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