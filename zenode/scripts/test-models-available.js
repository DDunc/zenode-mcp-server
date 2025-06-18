#!/usr/bin/env node

// Debug script to check what models are available in the provider registry

const testCommand = `docker exec zenode-server node -e "
  const { modelProviderRegistry } = require('./dist/providers/registry.js');
  
  async function debugModels() {
    console.log('🔍 Debugging model provider registry...');
    
    try {
      // Initialize registry 
      console.log('Available providers:');
      const providers = modelProviderRegistry.getProviders();
      console.log('Providers array length:', providers.length);
      
      for (const provider of providers) {
        console.log('Provider type:', provider.type);
        console.log('Provider friendly name:', provider.friendlyName);
        
        try {
          const models = await provider.getAvailableModels();
          console.log('Models from', provider.type + ':', models.length, 'models');
          
          // Check if openai/gpt-4o is in the list
          const gpt4o = models.find(m => m.includes('gpt-4o'));
          if (gpt4o) {
            console.log('✅ Found gpt-4o variants:', models.filter(m => m.includes('gpt-4o')));
          } else {
            console.log('❌ No gpt-4o models found');
            console.log('Sample models:', models.slice(0, 10));
          }
        } catch (error) {
          console.log('Error getting models from', provider.type + ':', error.message);
        }
      }
      
      // Test specific model lookup
      console.log('\\n🔍 Testing specific model lookup...');
      const targetModels = ['openai/gpt-4o', 'gpt-4o', 'vision', 'auto'];
      
      for (const model of targetModels) {
        try {
          const provider = await modelProviderRegistry.getProviderForModel(model);
          if (provider) {
            console.log('✅', model, '-> Provider:', provider.type);
          } else {
            console.log('❌', model, '-> No provider found');
          }
        } catch (error) {
          console.log('❌', model, '-> Error:', error.message);
        }
      }
      
    } catch (error) {
      console.log('Registry error:', error.message);
    }
  }
  
  debugModels().catch(console.error);
"`;

const { exec } = require('child_process');

exec(testCommand, { timeout: 30000 }, (error, stdout, stderr) => {
  console.log('🔍 Model Registry Debug Results:');
  if (stdout) console.log(stdout);
  if (stderr) console.log('STDERR:', stderr);
  if (error) console.log('ERROR:', error.message);
});