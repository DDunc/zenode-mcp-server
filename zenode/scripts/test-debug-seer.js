#!/usr/bin/env node

// Debug script to test seer tool execution directly
// This will help us identify exactly where the failure is occurring

const fs = require('fs');
const path = require('path');

async function debugSeer() {
  console.log('🔍 Debug: Testing seer tool execution');
  
  // Test 1: Check file access from current directory
  const testImagePath = './test-image.jpg';
  const absoluteTestImagePath = path.resolve(testImagePath);
  const workspaceImagePath = '/workspace/Documents/gitz/zen-mcp-server/test-image.jpg';
  
  console.log('📂 File Path Tests:');
  console.log('  Local path:', testImagePath);
  console.log('  Absolute path:', absoluteTestImagePath);
  console.log('  Workspace path:', workspaceImagePath);
  
  try {
    const stats = fs.statSync(absoluteTestImagePath);
    console.log('  ✅ File exists locally:', stats.size, 'bytes');
  } catch (error) {
    console.log('  ❌ File not found locally:', error.message);
  }
  
  // Test 2: Test direct seer tool call with zenode:seer
  console.log('\n🔮 Testing zenode:seer via MCP...');
  
  const { exec } = require('child_process');
  
  // Test the MCP tool through docker
  const testCommand = `docker exec zenode-server node -e "
    const { seerTool } = require('./dist/tools/seer.js');
    const testRequest = {
      prompt: 'Test image analysis',
      images: ['${workspaceImagePath}'],
      analysis_type: 'detailed',
      model: 'openai/gpt-4o'
    };
    
    console.log('Testing seer tool with request:', JSON.stringify(testRequest, null, 2));
    
    seerTool.execute(testRequest)
      .then(result => {
        console.log('✅ Seer result:', JSON.stringify(result, null, 2));
      })
      .catch(error => {
        console.log('❌ Seer error:', error.message);
        console.log('Error details:', error);
      });
  "`;
  
  exec(testCommand, { timeout: 30000 }, (error, stdout, stderr) => {
    console.log('Command output:');
    if (stdout) console.log('STDOUT:', stdout);
    if (stderr) console.log('STDERR:', stderr);
    if (error) console.log('ERROR:', error.message);
  });
}

debugSeer().catch(console.error);