#!/usr/bin/env node

// Direct test of Seer tool without MCP protocol
const { SeerTool } = require('./dist/tools/seer.js');

async function testSeer() {
  console.log('Testing Seer tool directly...');
  
  const seer = new SeerTool();
  
  const args = {
    prompt: "What do you see in this image?",
    images: ["/workspace/Documents/gitz/zen-mcp-server/zenode/demo-output/sample-face-1750205477893.jpg"],
    model: "auto"
  };
  
  console.log('Executing seer with args:', JSON.stringify(args, null, 2));
  
  try {
    const result = await seer.execute(args);
    console.log('Seer result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Seer error:', error);
  }
}

testSeer().catch(console.error);