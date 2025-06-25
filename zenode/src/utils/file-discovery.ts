/**
 * File discovery and directory traversal utilities for zenode tools
 * 
 * Functional-light approach to file system operations with composition,
 * pure functions, and minimal side effects. Inspired by Functional-Light JS.
 */

import fs from 'fs/promises';
import path from 'path';
import { constants, Stats, Dirent } from 'fs';
import { logger } from './logger.js';
import { 
  translatePathForEnvironment, 
  isPathSafe, 
  getFileExtension,
  isTextFile,
} from './file-utils.js';

// === TYPES ===

export interface FileDiscoveryConfig {
  maxFiles: number;
  maxDepth: number;
  includeExtensions: string[];
  excludeExtensions: string[];
  excludePatterns: RegExp[];
  includePatterns: RegExp[];
  includeHidden: boolean;
  maxFileSize: number;
  sortBy: 'modified' | 'size' | 'name';
  sortOrder: 'asc' | 'desc';
}

export interface FileDiscoveryResult {
  files: string[];
  totalFound: number;
  directoriesTraversed: number;
  excludedByFilters: number;
  excludedBySize: number;
  summary: string;
}

export interface FileInfo {
  path: string;
  stats: Stats;
  extension: string;
  isText: boolean;
}

// === CONFIGURATION FACTORIES ===

const createBaseConfig = (): FileDiscoveryConfig => ({
  maxFiles: 50,
  maxDepth: 5,
  includeExtensions: ['.ts', '.js', '.tsx', '.jsx', '.json', '.md'],
  excludeExtensions: [],
  excludePatterns: [/node_modules/, /\.git/, /dist/, /build/, /coverage/],
  includePatterns: [],
  includeHidden: false,
  maxFileSize: 512 * 1024, // 512KB
  sortBy: 'modified' as const,
  sortOrder: 'desc' as const,
});

const configOverrides = {
  analyze: {
    maxFiles: 100,
    maxDepth: 8,
    includeExtensions: ['.ts', '.js', '.tsx', '.jsx', '.json', '.md', '.yaml', '.yml'],
    maxFileSize: 1024 * 1024, // 1MB
  },
  codereview: {
    maxFiles: 50,
    maxDepth: 6,
    includeExtensions: ['.ts', '.js', '.tsx', '.jsx'],
    excludePatterns: [/node_modules/, /\.git/, /dist/, /build/, /coverage/, /test/, /spec/],
  },
  debug: {
    maxFiles: 200,
    maxDepth: 10,
    includeExtensions: ['.ts', '.js', '.tsx', '.jsx', '.json', '.log', '.md'],
    maxFileSize: 2 * 1024 * 1024, // 2MB
  },
  testgen: {
    maxFiles: 30,
    maxDepth: 5,
    includeExtensions: ['.ts', '.js', '.tsx', '.jsx'],
    excludePatterns: [/node_modules/, /\.git/, /dist/, /build/, /coverage/, /test/, /spec/, /\.test\./, /\.spec\./],
    maxFileSize: 256 * 1024, // 256KB
    sortBy: 'name' as const,
    sortOrder: 'asc' as const,
  },
};

// Pure function to create tool-specific config
export const createConfigForTool = (toolName: string) => (customConfig: Partial<FileDiscoveryConfig> = {}): FileDiscoveryConfig => {
  const base = createBaseConfig();
  const toolOverrides = configOverrides[toolName as keyof typeof configOverrides] || {};
  return { ...base, ...toolOverrides, ...customConfig };
};

// === PURE UTILITY FUNCTIONS ===

// Curried function for path safety checking
const createPathSafetyChecker = (logWarn: typeof logger.warn) => (inputPath: string): boolean => {
  const translatedPath = translatePathForEnvironment(inputPath);
  const isSafe = isPathSafe(translatedPath);
  if (!isSafe) {
    logWarn(`Skipping unsafe path: ${inputPath}`);
  }
  return isSafe;
};

// Pure predicate functions
const isHiddenFile = (name: string): boolean => name.startsWith('.');

const matchesPatterns = (patterns: RegExp[]) => (relativePath: string): boolean =>
  patterns.some(pattern => pattern.test(relativePath));

const hasValidExtension = (config: FileDiscoveryConfig) => (filePath: string): boolean => {
  const ext = getFileExtension(filePath);
  
  // Check inclusion first
  if (config.includeExtensions.length > 0) {
    return config.includeExtensions.includes(ext);
  }
  
  // Check exclusion
  if (config.excludeExtensions.length > 0) {
    return !config.excludeExtensions.includes(ext);
  }
  
  return true;
};

const isWithinSizeLimit = (maxSize: number) => (stats: Stats): boolean =>
  stats.size <= maxSize;

// Compose file validation predicates
const createFileValidator = (config: FileDiscoveryConfig) => (fileInfo: FileInfo): boolean => {
  const validators = [
    () => isWithinSizeLimit(config.maxFileSize)(fileInfo.stats),
    () => hasValidExtension(config)(fileInfo.path),
    () => fileInfo.isText,
  ];
  
  return validators.every(validate => validate());
};

// === FILE SYSTEM OPERATIONS ===

const safeReadStats = async (filePath: string): Promise<Stats | null> => {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
};

const safeReadDir = async (dirPath: string): Promise<Dirent[]> => {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    logger.debug(`Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

const safeRealPath = async (filePath: string): Promise<string | null> => {
  try {
    return await fs.realpath(filePath);
  } catch {
    return null;
  }
};

// === PROJECT ROOT DETECTION ===

const projectIndicators = [
  'package.json',
  '.git',
  'tsconfig.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'composer.json',
  'Gemfile',
  'requirements.txt',
  '.gitignore',
];

const hasProjectIndicator = async (dirPath: string, indicator: string): Promise<boolean> => {
  try {
    await fs.access(path.join(dirPath, indicator), constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const findProjectRootRecursive = async (currentPath: string, rootPath: string): Promise<string | null> => {
  if (currentPath === rootPath) {
    return null;
  }
  
  for (const indicator of projectIndicators) {
    if (await hasProjectIndicator(currentPath, indicator)) {
      logger.debug(`Found project root at ${currentPath} (indicator: ${indicator})`);
      return currentPath;
    }
  }
  
  const parentPath = path.dirname(currentPath);
  return parentPath === currentPath ? null : findProjectRootRecursive(parentPath, rootPath);
};

export const getProjectRoot = async (startPath?: string): Promise<string> => {
  const searchPath = path.resolve(startPath || process.cwd());
  const rootPath = path.parse(searchPath).root;
  
  const projectRoot = await findProjectRootRecursive(searchPath, rootPath);
  const result = projectRoot || searchPath;
  
  if (!projectRoot) {
    logger.debug(`No project root found, using ${searchPath}`);
  }
  
  return result;
};

// === FILE DISCOVERY CORE ===

const createFileInfo = async (filePath: string): Promise<FileInfo | null> => {
  const stats = await safeReadStats(filePath);
  if (!stats) return null;
  
  return {
    path: filePath,
    stats,
    extension: getFileExtension(filePath),
    isText: isTextFile(filePath),
  };
};

// Recursive directory traversal with functional composition
const traverseDirectoryRecursive = async (
  config: FileDiscoveryConfig,
  isPathSafe: (path: string) => boolean,
  visited: Set<string>
) => {
  const validateFile = createFileValidator(config);
  
  const traverse = async (
    currentPath: string, 
    depth: number,
    result: { files: FileInfo[]; totalFound: number; excludedByFilters: number; excludedBySize: number }
  ): Promise<typeof result> => {
    // Early termination conditions
    if (depth > config.maxDepth || result.files.length >= config.maxFiles) {
      return result;
    }
    
    // Symlink cycle detection
    const realPath = await safeRealPath(currentPath);
    if (!realPath || visited.has(realPath)) {
      return result;
    }
    visited.add(realPath);
    
    const entries = await safeReadDir(currentPath);
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const relativePath = path.relative(currentPath, fullPath);
      
      // Apply filters
      if (!config.includeHidden && isHiddenFile(entry.name)) {
        continue;
      }
      
      if (config.excludePatterns.length > 0 && matchesPatterns(config.excludePatterns)(relativePath)) {
        continue;
      }
      
      if (config.includePatterns.length > 0 && !matchesPatterns(config.includePatterns)(relativePath)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await traverse(fullPath, depth + 1, result);
      } else if (entry.isFile()) {
        result.totalFound++;
        
        const fileInfo = await createFileInfo(fullPath);
        if (!fileInfo) {
          continue;
        }
        
        if (validateFile(fileInfo)) {
          result.files.push(fileInfo);
          
          // Stop if we've reached the file limit
          if (result.files.length >= config.maxFiles) {
            return result;
          }
        } else {
          if (fileInfo.stats.size > config.maxFileSize) {
            result.excludedBySize++;
          } else {
            result.excludedByFilters++;
          }
        }
      }
    }
    
    return result;
  };
  
  return traverse;
};

// Pure sorting function
const createFileSorter = (config: FileDiscoveryConfig) => (files: FileInfo[]): FileInfo[] => {
  if (!config.sortBy || files.length <= 1) {
    return files.slice(0, config.maxFiles);
  }
  
  const comparators = {
    modified: (a: FileInfo, b: FileInfo) => a.stats.mtime.getTime() - b.stats.mtime.getTime(),
    size: (a: FileInfo, b: FileInfo) => a.stats.size - b.stats.size,
    name: (a: FileInfo, b: FileInfo) => a.path.localeCompare(b.path),
  };
  
  const comparator = comparators[config.sortBy];
  const sortedFiles = [...files].sort((a, b) => {
    const comparison = comparator(a, b);
    return config.sortOrder === 'desc' ? -comparison : comparison;
  });
  
  return sortedFiles.slice(0, config.maxFiles);
};

// Pure summary generation
const createSummary = (result: Omit<FileDiscoveryResult, 'summary'>): string => {
  const parts: string[] = [];
  
  parts.push(`Found ${result.files.length} files`);
  
  if (result.totalFound > result.files.length) {
    parts.push(`(${result.totalFound} total found, ${result.files.length} selected)`);
  }
  
  if (result.directoriesTraversed > 0) {
    parts.push(`from ${result.directoriesTraversed} directories`);
  }
  
  if (result.excludedByFilters > 0) {
    parts.push(`${result.excludedByFilters} excluded by filters`);
  }
  
  if (result.excludedBySize > 0) {
    parts.push(`${result.excludedBySize} excluded by size`);
  }
  
  return parts.join(', ');
};

// === MAIN DISCOVERY FUNCTIONS ===

export const discoverFiles = (config: FileDiscoveryConfig) => async (paths: string[]): Promise<FileDiscoveryResult> => {
  const isPathSafeChecker = createPathSafetyChecker(logger.warn);
  const sortFiles = createFileSorter(config);
  
  let result = {
    files: [] as string[],
    totalFound: 0,
    directoriesTraversed: 0,
    excludedByFilters: 0,
    excludedBySize: 0,
    summary: '',
  };
  
  const allFiles = new Set<FileInfo>();
  const processedPaths = new Set<string>();
  const visited = new Set<string>();
  
  for (const inputPath of paths) {
    const translatedPath = translatePathForEnvironment(inputPath);
    
    // Security and deduplication checks
    if (!isPathSafeChecker(inputPath) || processedPaths.has(translatedPath)) {
      continue;
    }
    processedPaths.add(translatedPath);
    
    const stats = await safeReadStats(translatedPath);
    if (!stats) {
      logger.warn(`Failed to access path: ${inputPath}`);
      continue;
    }
    
    if (stats.isFile()) {
      // Single file processing
      const fileInfo = await createFileInfo(translatedPath);
      if (fileInfo && createFileValidator(config)(fileInfo)) {
        allFiles.add(fileInfo);
        result.totalFound++;
      } else {
        result.excludedByFilters++;
      }
    } else if (stats.isDirectory()) {
      // Directory traversal
      const traverseResult = {
        files: [] as FileInfo[],
        totalFound: 0,
        excludedByFilters: 0,
        excludedBySize: 0,
      };
      
      const traverse = await traverseDirectoryRecursive(config, isPathSafeChecker, visited);
      await traverse(translatedPath, 0, traverseResult);
      
      result.directoriesTraversed++;
      result.totalFound += traverseResult.totalFound;
      result.excludedByFilters += traverseResult.excludedByFilters;
      result.excludedBySize += traverseResult.excludedBySize;
      
      traverseResult.files.forEach(file => allFiles.add(file));
    }
  }
  
  // Sort, limit, and extract paths
  const sortedFiles = sortFiles(Array.from(allFiles));
  result.files = sortedFiles.map(file => file.path);
  result.summary = createSummary(result);
  
  return result;
};

// === HIGH-LEVEL API ===

export const resolveFilePaths = async (
  paths: string[] | undefined,
  toolName: string,
  customConfig: Partial<FileDiscoveryConfig> = {}
): Promise<{
  files: string[];
  summary: string;
  usedDefaultPath: boolean;
}> => {
  let actualPaths = paths;
  let usedDefaultPath = false;
  
  // Default to project root if no paths provided
  if (!actualPaths || actualPaths.length === 0) {
    const projectRoot = await getProjectRoot();
    actualPaths = [projectRoot];
    usedDefaultPath = true;
    logger.info(`No files specified, using project root: ${projectRoot}`);
  }
  
  // Create tool-specific config and discover files
  const config = createConfigForTool(toolName)(customConfig);
  const discover = discoverFiles(config);
  const result = await discover(actualPaths);
  
  return {
    files: result.files,
    summary: result.summary,
    usedDefaultPath,
  };
};
