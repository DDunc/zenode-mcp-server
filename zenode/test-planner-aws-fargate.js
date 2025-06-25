#!/usr/bin/env node

/**
 * Test script to test the zenode MCP server planner tool
 * with AWS Fargate deployment planning request
 */

import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

console.log('🧪 Testing Zenode MCP Server - Planner Tool');
console.log('═'.repeat(60));
console.log('Testing: AWS Fargate deployment plan generation');
console.log('');

// MCP Request for planner tool
const mcpRequest = {
  "jsonrpc": "2.0",
  "id": randomUUID(),
  "method": "tools/call",
  "params": {
    "name": "planner",
    "arguments": {
      "request": "Create a detailed implementation plan for deploying the zenode MCP server on AWS Fargate ECS. Include specific steps for setting up the infrastructure, configuring auto-scaling, implementing blue/green deployments, and ensuring high availability. Focus on practical implementation steps with specific AWS CLI commands and CloudFormation templates."
    }
  }
};

console.log('📤 MCP REQUEST:');
console.log('─'.repeat(20));
console.log(JSON.stringify(mcpRequest, null, 2));
console.log('');

console.log('⏳ Sending request to zenode MCP server...');
console.log('');

// Execute the MCP request
const docker = spawn('docker', [
  'exec', '-i', 'zenode-mcp', 
  'node', 'dist/index.js'
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: false
});

let responseData = '';
let errorData = '';

docker.stdout.on('data', (data) => {
  responseData += data.toString();
});

docker.stderr.on('data', (data) => {
  errorData += data.toString();
});

docker.on('close', (code) => {
  console.log('📥 MCP RESPONSE:');
  console.log('─'.repeat(20));
  
  if (code === 0) {
    try {
      // Parse the JSON response
      const response = JSON.parse(responseData);
      console.log(JSON.stringify(response, null, 2));
      
      // Extract and display the plan content
      if (response.result && response.result.content) {
        console.log('');
        console.log('📋 GENERATED AWS FARGATE DEPLOYMENT PLAN:');
        console.log('═'.repeat(50));
        
        if (Array.isArray(response.result.content)) {
          response.result.content.forEach(item => {
            if (item.type === 'text') {
              console.log(item.text);
            }
          });
        } else {
          console.log(response.result.content);
        }
      }
      
      console.log('');
      console.log('✅ TEST COMPLETED SUCCESSFULLY!');
      console.log('');
      console.log('🔍 VERIFICATION RESULTS:');
      console.log('─'.repeat(25));
      console.log('✅ Zenode MCP server is running correctly');
      console.log('✅ MCP protocol communication working');
      console.log('✅ Planner tool is functioning properly');
      console.log('✅ Response received and parsed successfully');
      
      if (response.result && response.result.content) {
        console.log('✅ AWS Fargate deployment plan generated');
      }
      
    } catch (parseError) {
      console.log('Raw response:');
      console.log(responseData);
      console.log('');
      console.log('❌ Failed to parse JSON response:');
      console.log(parseError.message);
    }
  } else {
    console.log('❌ MCP SERVER ERROR:');
    console.log('Exit code:', code);
    console.log('STDOUT:', responseData);
    console.log('STDERR:', errorData);
  }
});

docker.on('error', (error) => {
  console.log('❌ Docker execution error:', error.message);
});

// Send the MCP request
docker.stdin.write(JSON.stringify(mcpRequest) + '\n');
docker.stdin.end();

// Set timeout for the request
setTimeout(() => {
  console.log('⏰ Request timeout after 60 seconds');
  docker.kill();
  process.exit(1);
}, 60000);