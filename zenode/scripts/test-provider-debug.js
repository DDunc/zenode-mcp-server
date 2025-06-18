#!/usr/bin/env node

const testCommand = `docker exec zenode-server node -e "
  const { modelProviderRegistry } = require('./dist/providers/registry.js');
  
  async function debugProviders() {
    try {
      console.log('🔍 Provider Registry Debug');
      
      // Initialize the registry first
      await modelProviderRegistry.initialize();
      
      // Check what providers are registered
      console.log('\\n📋 Testing provider lookup order for openai/gpt-4o...');
      
      const provider = await modelProviderRegistry.getProviderForModel('openai/gpt-4o');
      
      if (provider) {
        console.log('✅ Found provider for openai/gpt-4o:', provider.type, provider.friendlyName);
        
        // Test image capabilities
        try {
          const capabilities = await provider.getImageCapabilities('openai/gpt-4o');
          console.log('✅ Image capabilities:', JSON.stringify(capabilities, null, 2));
        } catch (capError) {
          console.log('❌ Image capabilities error:', capError.message);
        }
      } else {
        console.log('❌ No provider found for openai/gpt-4o');
      }
      
      // Check other models
      const testModels = ['gpt-4o', 'vision', 'pro', 'flash'];
      for (const model of testModels) {
        const p = await modelProviderRegistry.getProviderForModel(model);
        console.log(model + ':', p ? p.type : 'No provider');
      }
      
    } catch (error) {
      console.log('❌ Registry error:', error.message);
      console.log('Stack:', error.stack);
    }
  }
  
  debugProviders().catch(console.error);
"`;

const { exec } = require('child_process');

exec(testCommand, { timeout: 30000 }, (error, stdout, stderr) => {
  console.log('🔍 Provider Debug Results:');
  if (stdout) console.log(stdout);
  if (stderr) console.log('STDERR:', stderr);
  if (error) console.log('ERROR:', error.message);
});