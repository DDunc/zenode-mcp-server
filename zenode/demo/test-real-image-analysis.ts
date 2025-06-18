#!/usr/bin/env node
/**
 * Test Real Image Analysis
 * 
 * This script tests the actual image analysis functionality using our demo image
 * and shows how the MCP server would process the request.
 */

import { ChatTool } from '../src/tools/chat.js';
import { promises as fs } from 'fs';
import { resolve } from 'path';

async function testRealImageAnalysis(): Promise<void> {
  console.log('🧪 Testing Real Image Analysis with Demo Image');
  console.log('===============================================\n');
  
  // Path to our demo image
  const demoImagePath = resolve('./demo-output/demo-image-2025-06-17T23-26-02-432Z.png');
  
  // Check if demo image exists
  try {
    await fs.access(demoImagePath);
    console.log(`✅ Found demo image at: ${demoImagePath}`);
  } catch (error) {
    console.log(`❌ Demo image not found at: ${demoImagePath}`);
    console.log('   Please run the image demo first: npx tsx demo/image-demo.ts');
    return;
  }
  
  // Create chat tool instance
  const chatTool = new ChatTool();
  
  // Create the request that would come from an MCP client
  const request = {
    prompt: "What do you see in this image? Describe it in detail.",
    images: [demoImagePath],
    model: "anthropic/claude-3-sonnet", // This would use OpenRouter if only OR key is set
    temperature: 0.7,
  };
  
  console.log('📋 MCP Request:');
  console.log(JSON.stringify(request, null, 2));
  console.log('');
  
  try {
    console.log('🔄 Processing request through ChatTool...');
    
    // This is how the MCP server would process the request
    const result = await chatTool.execute(request);
    
    console.log('✅ MCP Response:');
    console.log('================');
    console.log(`Status: ${result.status}`);
    console.log(`Content Type: ${result.content_type}`);
    console.log('');
    console.log('Content:');
    console.log(result.content);
    
    if (result.metadata) {
      console.log('');
      console.log('Metadata:');
      console.log(JSON.stringify(result.metadata, null, 2));
    }
    
    if (result.continuation_offer) {
      console.log('');
      console.log('Continuation Offer:');
      console.log(result.continuation_offer);
    }
    
  } catch (error) {
    console.log('❌ Error processing request:');
    console.log(error);
    
    // Check if it's an API key issue
    if (error instanceof Error && error.message.includes('API')) {
      console.log('');
      console.log('💡 This might be due to missing API keys.');
      console.log('   For testing, you can set a dummy OpenRouter key:');
      console.log('   export OPENROUTER_API_KEY=test-key-for-demo');
      console.log('   (The image validation will still work even without real API access)');
    }
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testRealImageAnalysis().catch(console.error);
}

export { testRealImageAnalysis };