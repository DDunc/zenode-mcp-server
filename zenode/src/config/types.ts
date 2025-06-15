/**
 * Configuration types for zenode server
 */

export interface LoggingConfig {
  /** Pattern that triggers conversation logging (e.g., ":z", "z:", ">>") */
  conversationTrigger: string;
  /** Whether logging is enabled */
  enabled: boolean;
  /** Path where conversation logs are stored */
  logPath: string;
  /** Whether to include full request/response data */
  includeFullData: boolean;
}

export interface ShortcutsConfig {
  /** Prefix for tool coordination (e.g., "z:" becomes "z: analyze this") */
  coordinationPrefix: string;
  /** Full tool invocation prefix (e.g., "zenode:") */
  toolInvocation: string;
}

export interface ServerConfig {
  /** Server port (for future HTTP API) */
  port?: number;
  /** Server host */
  host?: string;
  /** Request timeout in milliseconds */
  requestTimeout: number;
  /** Maximum concurrent requests */
  maxConcurrentRequests: number;
}

export interface ZenodeConfig {
  /** Logging configuration */
  logging: LoggingConfig;
  /** Shortcut/keybinding configuration */
  shortcuts: ShortcutsConfig;
  /** Server configuration */
  server: ServerConfig;
  /** Config file version for migration support */
  version: string;
}

export const DEFAULT_CONFIG: ZenodeConfig = {
  logging: {
    conversationTrigger: ':z',
    enabled: true,
    logPath: '.zenode/conversation-logs',
    includeFullData: true
  },
  shortcuts: {
    coordinationPrefix: 'z:',
    toolInvocation: 'zenode:'
  },
  server: {
    requestTimeout: 30000,
    maxConcurrentRequests: 10
  },
  version: '1.0.0'
};