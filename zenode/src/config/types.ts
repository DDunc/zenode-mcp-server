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
  /** Output format for conversation logs */
  format: 'json' | 'markdown';
}

export interface ShortcutsConfig {
  /** Prefix for tool coordination (e.g., "z:" becomes "z: analyze this") */
  coordinationPrefix: string;
  /** Full tool invocation prefix (e.g., "zenode:") */
  toolInvocation: string;
  /** Minimum number of tools to coordinate when using :z command */
  minimumCoordinationTurns: number;
  /** Default tools to use for :z coordination */
  defaultCoordinationTools: string[];
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

export interface ModelsConfig {
  /** Path where local models are stored */
  modelsPath: string;
  /** Configuration for the gopher tool's local model */
  gopher?: {
    /** Path to the local model for gopher tool */
    modelPath?: string;
    /** Actual model name/filename */
    modelName?: string;
    /** URL to download the model from */
    modelSrcUrl?: string;
  };
}

export interface SecurityConfig {
  /** Whether to enforce workspace path restrictions (legacy feature) */
  enforceWorkspaceRestrictions: boolean;
  /** Workspace root path (only used if enforceWorkspaceRestrictions is true) */
  workspaceRoot?: string;
}

export interface ZenodeConfig {
  /** Logging configuration */
  logging: LoggingConfig;
  /** Shortcut/keybinding configuration */
  shortcuts: ShortcutsConfig;
  /** Server configuration */
  server: ServerConfig;
  /** Local models configuration */
  models: ModelsConfig;
  /** Security configuration */
  security: SecurityConfig;
  /** Config file version for migration support */
  version: string;
}

export const DEFAULT_CONFIG: ZenodeConfig = {
  logging: {
    conversationTrigger: ':z',
    enabled: true,
    logPath: '.zenode/conversation-logs',
    includeFullData: true,
    format: 'markdown'
  },
  shortcuts: {
    coordinationPrefix: ':z',
    toolInvocation: 'zenode:',
    minimumCoordinationTurns: 4,
    defaultCoordinationTools: ['analyze', 'thinkdeep', 'debug']
  },
  server: {
    requestTimeout: 30000,
    maxConcurrentRequests: 10
  },
  models: {
    modelsPath: '.zenode/models',
    gopher: {
      modelPath: '.zenode/models/gopher',
      modelName: 'qwen2.5:0.5b',
      modelSrcUrl: 'https://ollama.com/library/qwen2.5:0.5b'
    }
  },
  security: {
    // DISABLED by default - enables direct path mapping without workspace restrictions
    enforceWorkspaceRestrictions: false,
    // Only used if enforceWorkspaceRestrictions is true
    workspaceRoot: process.env.MCP_WORKSPACE || process.cwd()
  },
  version: '1.0.0'
};