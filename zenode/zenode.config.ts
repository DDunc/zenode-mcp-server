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
    includeFullData: true
  },
  
  shortcuts: {
    // The prefix that enables tool coordination
    // "z: analyze this file" will coordinate with analyze tool
    coordinationPrefix: 'z:',
    
    // Full tool invocation prefix (for future use)
    toolInvocation: 'zenode:'
  },
  
  server: {
    // Request timeout in milliseconds
    requestTimeout: 30000,
    
    // Maximum concurrent requests
    maxConcurrentRequests: 10,
    
    // Optional: HTTP server port (for future API)
    // port: 3000,
    // host: 'localhost'
  }
};

export default config;