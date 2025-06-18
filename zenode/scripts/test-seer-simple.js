#!/usr/bin/env node

const testCommand = `docker exec zenode-server node -e "
  const { modelProviderRegistry } = require('./dist/providers/registry.js');
  
  async function testRegistry() {
    try {
      console.log('🔍 Testing model provider registry...');
      await modelProviderRegistry.initialize();
      console.log('✅ Registry initialized');
      
      // Test provider lookup for Llama
      const llamaProvider = await modelProviderRegistry.getProviderForModel('meta-llama/llama-3.2-11b-vision-instruct');
      console.log('Llama provider:', llamaProvider ? llamaProvider.type : 'Not found');
      
      // Test provider lookup for GPT-4o
      const gptProvider = await modelProviderRegistry.getProviderForModel('openai/gpt-4o');
      console.log('GPT-4o provider:', gptProvider ? gptProvider.type : 'Not found');
      
      // List available models
      const models = await modelProviderRegistry.getAvailableModels();
      console.log('Total models available:', models.length);
      
      const visionModels = models.filter(m => m.includes('vision') || m.includes('gpt-4o') || m.includes('llama-3.2-11b'));
      console.log('Vision models found:', visionModels);
      
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
  
  testRegistry();
"`;

const { exec } = require('child_process');

exec(testCommand, { timeout: 30000 }, (error, stdout, stderr) => {
  console.log('🔍 Registry Test Results:');
  if (stdout) console.log(stdout);
  if (stderr && stderr.length < 500) console.log('STDERR:', stderr);
  if (error) console.log('ERROR:', error.message);
});