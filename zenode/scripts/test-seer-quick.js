#!/usr/bin/env node

const testCommand = `timeout 30 docker exec zenode-server node -e "
  const { modelProviderRegistry } = require('./dist/providers/registry.js');
  const { seerTool } = require('./dist/tools/seer.js');
  
  async function testSeer() {
    try {
      console.log('Initializing registry...');
      await modelProviderRegistry.initialize();
      console.log('Registry initialized successfully!');
      
      // Test provider lookup
      const provider = await modelProviderRegistry.getProviderForModel('meta-llama/llama-3.2-11b-vision-instruct');
      if (provider) {
        console.log('✅ Found provider for Llama vision:', provider.type);
      } else {
        console.log('❌ No provider found for Llama vision');
        return;
      }
      
      const testRequest = {
        prompt: 'What is in this image?',
        images: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg'],
        analysis_type: 'detailed',
        model: 'meta-llama/llama-3.2-11b-vision-instruct'
      };
      
      console.log('Executing seer tool...');
      const result = await seerTool.execute(testRequest);
      
      console.log('Result status:', result.status);
      if (result.status === 'success') {
        console.log('Content preview:', result.content.substring(0, 200) + '...');
      } else {
        console.log('Error content:', result.content);
      }
      
    } catch (error) {
      console.log('Error:', error.message);
    }
  }
  
  testSeer();
"`;

const { exec } = require('child_process');

exec(testCommand, { timeout: 45000 }, (error, stdout, stderr) => {
  console.log('🔮 Quick Seer Test:');
  if (stdout) console.log(stdout);
  if (stderr && stderr.length < 1000) console.log('STDERR:', stderr);
  if (error) console.log('ERROR:', error.message);
});