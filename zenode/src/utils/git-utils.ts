/**
 * Git utilities for repository operations
 * 
 * This module provides functions for discovering git repositories,
 * checking status, running git commands, and generating diffs.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger.js';

const execAsync = promisify(exec);

/**
 * Git status information
 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  hasChanges: boolean;
}

/**
 * Git command result
 */
export interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Options for generating git diffs
 */
export interface DiffOptions {
  compareToRef?: string;
  includeStaged?: boolean;
  includeUnstaged?: boolean;
  contextLines?: number;
}

/**
 * Repository diff information
 */
export interface RepositoryDiff {
  repoPath: string;
  diffs: FileDiff[];
  totalLines: number;
  truncated: boolean;
}

/**
 * Individual file diff
 */
export interface FileDiff {
  path: string;
  diff: string;
  additions: number;
  deletions: number;
  truncated: boolean;
}

/**
 * Find git repositories recursively
 */
export async function findGitRepositories(
  basePath: string, 
  maxDepth: number = 5
): Promise<string[]> {
  const repositories: string[] = [];
  
  async function searchDirectory(dirPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;
    
    try {
      // Check if this directory is a git repository
      const gitDir = path.join(dirPath, '.git');
      try {
        const stat = await fs.stat(gitDir);
        if (stat.isDirectory()) {
          repositories.push(dirPath);
          logger.debug(`Found git repository: ${dirPath}`);
          return; // Don't search subdirectories of git repos
        }
      } catch {
        // .git doesn't exist, continue searching
      }
      
      // Search subdirectories
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const subdirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'));
      
      await Promise.all(
        subdirs.map(subdir => 
          searchDirectory(path.join(dirPath, subdir.name), depth + 1)
        )
      );
    } catch (error) {
      logger.warn(`Error searching directory ${dirPath}:`, error);
    }
  }
  
  await searchDirectory(basePath, 0);
  return repositories.sort();
}

/**
 * Get git status for a repository
 */
export async function getGitStatus(repoPath: string): Promise<GitStatus> {
  try {
    // Get current branch
    const branchResult = await runGitCommand('git rev-parse --abbrev-ref HEAD', repoPath);
    const branch = branchResult.stdout.trim();
    
    // Get ahead/behind counts
    let ahead = 0;
    let behind = 0;
    try {
      const upstreamResult = await runGitCommand(
        `git rev-list --left-right --count ${branch}...${branch}@{upstream}`,
        repoPath
      );
      const [aheadStr, behindStr] = upstreamResult.stdout.trim().split('\t');
      ahead = parseInt(aheadStr || '0') || 0;
      behind = parseInt(behindStr || '0') || 0;
    } catch {
      // No upstream branch
    }
    
    // Get file status
    const statusResult = await runGitCommand('git status --porcelain', repoPath);
    const lines = statusResult.stdout.split('\n').filter(line => line.length > 0);
    
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    
    for (const line of lines) {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      
      if (status === '??') {
        untracked.push(file);
      } else if (status[0] !== ' ' && status[0] !== '?') {
        staged.push(file);
      }
      if (status[1] !== ' ' && status[1] !== '?') {
        unstaged.push(file);
      }
    }
    
    return {
      branch,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      hasChanges: staged.length > 0 || unstaged.length > 0 || untracked.length > 0,
    };
  } catch (error) {
    logger.error(`Failed to get git status for ${repoPath}:`, error);
    throw error;
  }
}

/**
 * Run a git command in a specific directory
 */
export async function runGitCommand(
  command: string, 
  cwd: string
): Promise<GitCommandResult> {
  try {
    const { stdout, stderr } = await execAsync(command, { 
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    
    return {
      stdout,
      stderr,
      exitCode: 0,
    };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    };
  }
}

/**
 * Get git diff for a repository
 */
export async function getGitDiff(
  repoPath: string, 
  options: DiffOptions = {}
): Promise<string> {
  const {
    compareToRef,
    includeStaged = true,
    includeUnstaged = true,
    contextLines = 3,
  } = options;
  
  try {
    let diffCommand: string;
    
    if (compareToRef) {
      // Compare against a specific ref (branch, tag, commit)
      diffCommand = `git diff ${compareToRef}...HEAD --unified=${contextLines}`;
    } else {
      // Get local changes
      const diffs: string[] = [];
      
      if (includeStaged) {
        const stagedResult = await runGitCommand(
          `git diff --cached --unified=${contextLines}`,
          repoPath
        );
        if (stagedResult.stdout.trim()) {
          diffs.push('=== STAGED CHANGES ===\n' + stagedResult.stdout);
        }
      }
      
      if (includeUnstaged) {
        const unstagedResult = await runGitCommand(
          `git diff --unified=${contextLines}`,
          repoPath
        );
        if (unstagedResult.stdout.trim()) {
          diffs.push('=== UNSTAGED CHANGES ===\n' + unstagedResult.stdout);
        }
      }
      
      return diffs.join('\n\n');
    }
    
    const result = await runGitCommand(diffCommand, repoPath);
    return result.stdout;
  } catch (error) {
    logger.error(`Failed to get git diff for ${repoPath}:`, error);
    throw error;
  }
}

/**
 * Get list of changed files
 */
export async function getChangedFiles(
  repoPath: string,
  compareToRef?: string
): Promise<string[]> {
  try {
    let command: string;
    
    if (compareToRef) {
      command = `git diff --name-only ${compareToRef}...HEAD`;
    } else {
      // Get both staged and unstaged changes
      command = 'git diff --name-only HEAD';
    }
    
    const result = await runGitCommand(command, repoPath);
    return result.stdout
      .split('\n')
      .filter(file => file.trim().length > 0)
      .map(file => path.join(repoPath, file));
  } catch (error) {
    logger.error(`Failed to get changed files for ${repoPath}:`, error);
    return [];
  }
}

/**
 * Check if a path is inside a git repository
 */
export async function isGitRepository(dirPath: string): Promise<boolean> {
  try {
    const result = await runGitCommand('git rev-parse --git-dir', dirPath);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get the root directory of a git repository
 */
export async function getGitRoot(dirPath: string): Promise<string | null> {
  try {
    const result = await runGitCommand('git rev-parse --show-toplevel', dirPath);
    if (result.exitCode === 0) {
      return result.stdout.trim();
    }
  } catch {
    // Not a git repository
  }
  return null;
}