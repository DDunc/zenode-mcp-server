#!/usr/bin/env node

// Test the new visit tool for reverse image search
const { execSync } = require('child_process');

const imageUrl = 'https://miro.medium.com/v2/resize:fit:720/format/webp/1*AkKIRQNiuy2q7at1nJynbA.jpeg';

console.log('🔍 Testing zenode:visit tool with reverse image search...\n');

try {
  console.log('Testing reverse image search with SerpAPI...');
  
  // Test using the CLI mode
  const command = `cd zenode && node dist/index.js visit '{"prompt": "Reverse search this image: ${imageUrl}", "action": "reverse_image_search", "url": "${imageUrl}"}'`;
  
  console.log('Running command:');
  console.log(command);
  console.log('\n=== ZENODE:VISIT OUTPUT ===');
  
  const result = execSync(command, { 
    encoding: 'utf8',
    cwd: '/Users/edunc/Documents/gitz/zen-mcp-server',
    timeout: 60000 
  });
  
  console.log(result);
  console.log('\n=== END OUTPUT ===');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.stdout) {
    console.log('\nSTDOUT:', error.stdout);
  }
  if (error.stderr) {
    console.log('\nSTDERR:', error.stderr);
  }
}