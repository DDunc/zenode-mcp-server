/**
 * Zenode TypeScript Configuration
 * This file takes priority over zenode-config.json
 */

import type { ZenodeConfig } from './src/config/types.js';

const config: ZenodeConfig = {
  version: '1.0.0',
  
  logging: {
    // Change this to customize what triggers conversation logging
    // Examples: ":z", ">>", "log:", "capture:"
    conversationTrigger: ':z',
    enabled: true,
    logPath: '.zenode/conversation-logs',
    includeFullData: true,
    // Output format: 'json' for structured data, 'markdown' for readable conversations
    format: 'markdown'
  },
  
  shortcuts: {
    // The prefix that enables tool coordination
    // ":z analyze this file" will coordinate with analyze tool
    coordinationPrefix: ':z',
    
    // Full tool invocation prefix (for future use)
    toolInvocation: 'zenode:',
    
    // Minimum number of tools to coordinate when using :z command
    minimumCoordinationTurns: 4,
    
    // Default tools to use for :z coordination
    defaultCoordinationTools: ['analyze', 'thinkdeep', 'debug']
  },
  
  server: {
    // Request timeout in milliseconds
    requestTimeout: 30000,
    
    // Maximum concurrent requests
    maxConcurrentRequests: 10,
    
    // Optional: HTTP server port (for future API)
    // port: 3000,
    // host: 'localhost'
  },
  
  models: {
    // Base directory for storing local models
    modelsPath: '.zenode/models',
    
    // Gopher tool model configuration
    gopher: {
      // Local model download path for gopher tool  
      modelPath: '.zenode/models/gopher',
      // Ollama model name (currently used: qwen2.5:0.5b)
      modelName: 'qwen2.5:0.5b',
      // Ollama model reference URL
      modelSrcUrl: 'https://ollama.com/library/qwen2.5:0.5b'
    }
  },
  
  security: {
    // WORKSPACE RESTRICTIONS: Set to false for direct path mapping (recommended)
    // Set to true to enable legacy workspace boundary enforcement
    enforceWorkspaceRestrictions: false,
    
    // Only used if enforceWorkspaceRestrictions is true
    // workspaceRoot: '/custom/workspace/path'
  }
};

export default config;