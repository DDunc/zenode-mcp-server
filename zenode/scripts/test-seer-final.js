#!/usr/bin/env node

const testCommand = `docker exec zenode-server node -e "
  const { modelProviderRegistry } = require('./dist/providers/registry.js');
  const { seerTool } = require('./dist/tools/seer.js');
  
  async function testSeer() {
    // Initialize the registry like the MCP server does
    await modelProviderRegistry.initialize();
    
    const testRequest = {
      prompt: 'What is in this image? Analyze this landscape photo in detail, describing the scenery, colors, lighting, and composition.',
      images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg'],
      analysis_type: 'detailed',
      model: 'meta-llama/llama-3.2-11b-vision-instruct'
    };
    
    console.log('🔮 Testing zenode:seer with Llama 3.2 Vision...');
    console.log('Image URL:', testRequest.images[0].substring(0, 80) + '...');
    console.log('Model:', testRequest.model);
    
    try {
      const result = await seerTool.execute(testRequest);
      
      if (result.status === 'success') {
        console.log('\\n✅ SUCCESS! Seer vision analysis:');
        console.log('-------------------------------------------');
        console.log(result.content);
        console.log('-------------------------------------------');
        if (result.metadata) {
          console.log('Model used:', result.metadata.model_used);
          console.log('Vision model:', result.metadata.vision_model);
          console.log('Images processed:', result.metadata.images_processed);
        }
      } else {
        console.log('\\n❌ FAILED:', result.content);
      }
    } catch (error) {
      console.log('\\n❌ ERROR:', error.message);
    }
  }
  
  testSeer().catch(console.error);
"`;

const { exec } = require('child_process');

exec(testCommand, { timeout: 120000 }, (error, stdout, stderr) => {
  console.log('🔮 Final Seer Test Results:');
  if (stdout) console.log(stdout);
  if (stderr && !stderr.includes('Logger initialized')) {
    console.log('STDERR:', stderr);
  }
  if (error) console.log('ERROR:', error.message);
});