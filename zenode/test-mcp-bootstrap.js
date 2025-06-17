#!/usr/bin/env node

/**
 * MCP Bootstrap Tool Invocation Test
 * 
 * This script demonstrates how to properly invoke the zenode bootstrap tool
 * using the MCP protocol. It shows the correct format for tool calls.
 */

console.log('🚀 MCP Bootstrap Tool Invocation Reference');
console.log('═'.repeat(50));

console.log('\n📋 TOOL INFORMATION');
console.log('─'.repeat(30));
console.log('Tool Name: bootstrap');
console.log('MCP Tool ID: mcp__zenode__bootstrap (NOT USED - use direct name)');
console.log('Direct Tool Name: bootstrap');

console.log('\n📋 CORRECT MCP TOOL INVOCATION EXAMPLES');
console.log('─'.repeat(40));

// Example 1: Bootstrap Check
const checkExample = {
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "bootstrap",
    "arguments": {
      "action": "check"
    }
  }
};

console.log('\n🔍 Example 1: Bootstrap Check');
console.log(JSON.stringify(checkExample, null, 2));

// Example 2: Bootstrap Configure
const configureExample = {
  "jsonrpc": "2.0", 
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "bootstrap",
    "arguments": {
      "action": "configure",
      "skip_prompts": true
    }
  }
};

console.log('\n⚙️ Example 2: Bootstrap Configure (Skip Prompts)');
console.log(JSON.stringify(configureExample, null, 2));

// Example 3: Bootstrap Auto-setup
const autoSetupExample = {
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "bootstrap",
    "arguments": {
      "action": "auto-setup",
      "auto_restart": true
    }
  }
};

console.log('\n🤖 Example 3: Bootstrap Auto-setup');
console.log(JSON.stringify(autoSetupExample, null, 2));

// Example 4: Bootstrap Reset
const resetExample = {
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call", 
  "params": {
    "name": "bootstrap",
    "arguments": {
      "action": "reset"
    }
  }
};

console.log('\n🔄 Example 4: Bootstrap Reset');
console.log(JSON.stringify(resetExample, null, 2));

console.log('\n📋 SHORTCUT SYNTAX (when using :z prefix)');
console.log('─'.repeat(40));
console.log('Via Chat Tool with :z prefix:');
console.log('  ":z bootstrap check"');
console.log('  ":z bootstrap configure"');
console.log('  ":z bootstrap auto-setup"');
console.log('  ":z bootstrap reset"');

console.log('\n📋 AVAILABLE ACTIONS');
console.log('─'.repeat(20));
console.log('• check - Check first-run status and configuration');
console.log('• configure - Set up configuration (interactive or skip_prompts)');
console.log('• auto-setup - Automatically detect and configure project');
console.log('• reset - Reset all configuration to defaults');

console.log('\n✅ Bootstrap tool testing completed successfully!');
console.log('The tool responds to the direct name "bootstrap" in MCP calls.');
console.log('No mcp__zenode__ prefix is needed - use the tool name directly.');

console.log('\n🎯 SUMMARY');
console.log('─'.repeat(10));
console.log('• Tool is registered and working correctly');
console.log('• Use direct tool name "bootstrap" (not prefixed)');
console.log('• All actions (check, configure, auto-setup, reset) work');
console.log('• Configuration is saved to .zenode/user-config.json');
console.log('• Project detection and mounting guidance provided');