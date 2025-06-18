#!/usr/bin/env node

const testCommand = `docker exec zenode-server node -e "
  const { modelProviderRegistry } = require('./dist/providers/registry.js');
  const { seerTool } = require('./dist/tools/seer.js');
  
  async function testSeerLive() {
    try {
      await modelProviderRegistry.initialize();
      
      const testRequest = {
        prompt: 'Briefly describe what you see in this image.',
        images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg'],
        analysis_type: 'description',
        model: 'meta-llama/llama-3.2-11b-vision-instruct'
      };
      
      console.log('🔮 Testing live seer execution...');
      console.log('Model: meta-llama/llama-3.2-11b-vision-instruct');
      console.log('Image: Wikipedia nature boardwalk');
      console.log('');
      
      const result = await seerTool.execute(testRequest);
      
      console.log('Status:', result.status);
      
      if (result.status === 'success') {
        console.log('\\n🎉 VISION ANALYSIS SUCCESS!');
        console.log('==========================================');
        console.log(result.content);
        console.log('==========================================');
        
        if (result.metadata) {
          console.log('\\nMetadata:');
          console.log('- Model used:', result.metadata.model_used);
          console.log('- Vision model:', result.metadata.vision_model);  
          console.log('- Images processed:', result.metadata.images_processed);
          console.log('- Token usage:', result.metadata.token_usage);
        }
      } else {
        console.log('\\n❌ FAILED:');
        console.log(result.content);
      }
      
    } catch (error) {
      console.log('\\n💥 ERROR:', error.message);
    }
  }
  
  testSeerLive();
"`;

console.log('🚀 Starting live zenode:seer test with Llama 3.2 Vision...');
console.log('This may take 30-60 seconds to complete the API call to OpenRouter...');

const { exec } = require('child_process');

exec(testCommand, { timeout: 90000 }, (error, stdout, stderr) => {
  console.log('\n🔮 Live Seer Test Results:');
  console.log('=====================================');
  if (stdout) console.log(stdout);
  if (stderr && !stderr.includes('Logger initialized') && stderr.length < 1000) {
    console.log('\nSTDERR:', stderr);
  }
  if (error) console.log('\nERROR:', error.message);
});