/**
 * MCP-Safe Console Wrapper
 * 
 * When running as an MCP server, console output breaks the JSON-RPC protocol.
 * This module provides console replacements that are MCP-aware.
 */

import { logger } from './logger.js';

// Detect if we're running in MCP mode
const isMCPMode = (): boolean => {
  // Check if running with stdin/stdout (MCP mode)
  // CLI mode will have arguments beyond just the script name
  return process.argv.length <= 2 && !process.env.ZENODE_CLI_MODE;
};

// Create MCP-safe console methods
export const mcpConsole = {
  log: (...args: any[]) => {
    if (!isMCPMode()) {
      console.log(...args);
    } else {
      // In MCP mode, use logger instead
      logger.debug('Console output suppressed in MCP mode:', args.join(' '));
    }
  },
  
  error: (...args: any[]) => {
    if (!isMCPMode()) {
      console.error(...args);
    } else {
      logger.error('Console error suppressed in MCP mode:', args.join(' '));
    }
  },
  
  warn: (...args: any[]) => {
    if (!isMCPMode()) {
      console.warn(...args);
    } else {
      logger.warn('Console warning suppressed in MCP mode:', args.join(' '));
    }
  },
  
  info: (...args: any[]) => {
    if (!isMCPMode()) {
      console.info(...args);
    } else {
      logger.info('Console info suppressed in MCP mode:', args.join(' '));
    }
  },
  
  debug: (...args: any[]) => {
    if (!isMCPMode()) {
      console.debug(...args);
    } else {
      logger.debug('Console debug suppressed in MCP mode:', args.join(' '));
    }
  }
};

// Override global console in MCP mode
if (isMCPMode()) {
  global.console = mcpConsole as any;
}