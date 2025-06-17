/**
 * Logging configuration for Zenode MCP Server
 *
 * Provides structured logging with Winston, including:
 * - Console output for development
 * - File rotation for production logs
 * - Activity tracking for MCP operations
 * - Timezone-aware timestamps
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { LOG_LEVEL } from '../config.js';

// Custom format for local timezone timestamps
const localTimestamp = winston.format((info) => {
  info.timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  });
  return info;
});

// Create formatters
const consoleFormat = winston.format.combine(
  localTimestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let output = `${timestamp} - ${level}: ${message}`;
    if (Object.keys(meta).length > 0) {
      output += ` ${JSON.stringify(meta)}`;
    }
    return output;
  }),
);

const fileFormat = winston.format.combine(
  localTimestamp(),
  winston.format.json({
    space: 2,
  }),
);

// Create transports
const transports: winston.transport[] = [];

// Console transport (always enabled, but respects log level)
// Use stderr to avoid interfering with MCP stdin/stdout protocol
transports.push(
  new winston.transports.Console({
    level: LOG_LEVEL.toLowerCase(),
    format: consoleFormat,
    stderrLevels: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
  }),
);

// File transports (for Docker environments)
if (process.env.NODE_ENV !== 'test') {
  try {
    // Main server log with daily rotation
    const mainLogTransport = new DailyRotateFile({
      filename: '/tmp/zenode_mcp_server-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      level: LOG_LEVEL.toLowerCase(),
      format: fileFormat,
    });

    // Error log (separate file for errors only)
    const errorLogTransport = new DailyRotateFile({
      filename: '/tmp/zenode_mcp_server_error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      format: fileFormat,
    });

    transports.push(mainLogTransport, errorLogTransport);
  } catch (error) {
    console.error('Warning: Could not set up file logging:', error);
  }
}

// Create main logger
export const logger = winston.createLogger({
  level: LOG_LEVEL.toLowerCase(),
  transports,
  // Don't exit on uncaught errors
  exitOnError: false,
});

// Create specialized logger for MCP activity tracking
const mcpActivityTransports: winston.transport[] = [];

if (process.env.NODE_ENV !== 'test') {
  try {
    const activityTransport = new DailyRotateFile({
      filename: '/tmp/zenode_mcp_activity-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '7d',
      level: 'info',
      format: winston.format.combine(
        localTimestamp(),
        winston.format.printf(({ timestamp, message }) => `${timestamp} - ${message}`),
      ),
    });

    mcpActivityTransports.push(activityTransport);
  } catch (error) {
    logger.warn('Could not set up MCP activity logging:', error);
  }
}

export const mcpActivityLogger = winston.createLogger({
  level: 'info',
  transports: mcpActivityTransports,
  silent: process.env.NODE_ENV === 'test' || mcpActivityTransports.length === 0,
});

// Handle logger errors
logger.on('error', (error) => {
  console.error('Logger error:', error);
});

mcpActivityLogger.on('error', (error) => {
  console.error('MCP activity logger error:', error);
});

// Log startup information
logger.info('Logger initialized', {
  level: LOG_LEVEL,
  environment: process.env.NODE_ENV,
  transports: transports.length,
});

// Helper function to create child logger with metadata
export function createChildLogger(metadata: Record<string, any>) {
  return logger.child(metadata);
}

// Helper function for structured error logging
export function logError(message: string, error: unknown, metadata?: Record<string, any>) {
  const errorInfo: Record<string, any> = {
    ...metadata,
  };

  if (error instanceof Error) {
    errorInfo.error = {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  } else {
    errorInfo.error = error;
  }

  logger.error(message, errorInfo);
}