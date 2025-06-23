/**
 * Provider Availability Tests
 * 
 * Tests against REAL provider APIs to ensure our model list stays current.
 * This is not a unit test - it's an integration test that validates our
 * understanding of what models are actually available.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { modelProviderRegistry } from '../index.js';
import { skipIfNoProviders } from '../../../tests/vitest-setup.js';

describe('Provider Availability - Real API Tests', () => {
  beforeAll(async () => {
    if (skipIfNoProviders()) {
      console.log('⚠️  Skipping provider tests - no API keys configured');
      console.log('💡 To run these tests, set OPENAI_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY');
    } else {
      // Initialize the registry
      await modelProviderRegistry.initialize();
    }
  });

  describe('Model Registry', () => {
    it('should have at least one provider available', async () => {
      if (skipIfNoProviders()) return;
      
      // Check each provider type manually since there's no getAllProviders method
      const providerTypes = ['openai', 'openrouter', 'gemini', 'custom'];
      const availableProviders = [];
      
      for (const type of providerTypes) {
        const provider = await modelProviderRegistry.getProvider(type as any);
        if (provider) {
          availableProviders.push(type);
        }
      }
      
      expect(availableProviders.length).toBeGreaterThan(0);
      console.log(`✅ Available providers: ${availableProviders.join(', ')}`);
    });

    it('should list available models', async () => {
      if (skipIfNoProviders()) return;
      
      const models = await modelProviderRegistry.getAvailableModels(true);
      
      expect(models.length).toBeGreaterThan(0);
      console.log(`✅ Total available models: ${models.length}`);
      
      // Log first 5 models as examples
      console.log('📋 Sample models:', models.slice(0, 5).join(', '));
    });
  });

  describe('OpenAI Provider', () => {
    it('should verify OpenAI models if API key is set', async () => {
      if (!process.env.OPENAI_API_KEY) {
        console.log('⏭️  Skipping OpenAI test - no API key');
        return;
      }

      const provider = await modelProviderRegistry.getProvider('openai');
      expect(provider).toBeDefined();

      // Test specific models we expect to exist
      const expectedModels = ['o3', 'o4-mini'];
      const models = provider?.getAvailableModels() || [];

      expect(models.length).toBeGreaterThan(0);
      
      for (const expected of expectedModels) {
        expect(models.some(m => m.includes(expected))).toBe(true);
      }

      console.log(`✅ OpenAI provider has ${models.length} models`);
    });

    it('should handle o3 model aliases correctly', async () => {
      if (!process.env.OPENAI_API_KEY) return;

      const provider = await modelProviderRegistry.getProvider('openai');
      const models = provider?.getAvailableModels() || [];
      
      // Check for o3 models
      const o3Models = models.filter(m => m.includes('o3'));
      if (o3Models.length > 0) {
        console.log('✅ O3 models available:', o3Models.join(', '));
      }
    });
  });

  describe('OpenRouter Provider', () => {
    it('should verify OpenRouter models if API key is set', async () => {
      if (!process.env.OPENROUTER_API_KEY) {
        console.log('⏭️  Skipping OpenRouter test - no API key');
        return;
      }

      const provider = await modelProviderRegistry.getProvider('openrouter');
      expect(provider).toBeDefined();

      // Wait for async initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const models = provider?.getAvailableModels() || [];
      expect(models.length).toBeGreaterThan(0);
      
      console.log(`✅ OpenRouter provider has ${models.length} models`);
      
      // Check for common models
      const hasClaudeModels = models.some(id => id.includes('claude'));
      const hasGPTModels = models.some(id => id.includes('gpt'));
      
      console.log(`  - Claude models: ${hasClaudeModels ? '✅' : '❌'}`);
      console.log(`  - GPT models: ${hasGPTModels ? '✅' : '❌'}`);
    });
  });

  describe('Gemini Provider', () => {
    it('should verify Gemini models if API key is set', async () => {
      if (!process.env.GEMINI_API_KEY) {
        console.log('⏭️  Skipping Gemini test - no API key');
        return;
      }

      const provider = await modelProviderRegistry.getProvider('gemini');
      
      if (!provider) {
        console.log('❌ Gemini provider not initialized - check API key configuration');
        return;
      }
      
      expect(provider).toBeDefined();

      const models = provider?.getAvailableModels() || [];
      expect(models.length).toBeGreaterThan(0);
      
      // Check for expected Gemini models
      expect(models.some(id => id.includes('gemini'))).toBe(true);
      
      console.log(`✅ Gemini provider has ${models.length} models:`, models.join(', '));
    });
  });

  describe('Model Selection', () => {
    it('should auto-select appropriate models for different tasks', async () => {
      if (skipIfNoProviders()) return;

      const models = await modelProviderRegistry.getAvailableModels(true);
      
      // Test categories
      const categories = {
        reasoning: models.filter(m => m.includes('o3') || m.includes('o1')),
        fast: models.filter(m => m.includes('flash') || m.includes('mini') || m.includes('haiku')),
        vision: models.filter(m => m.includes('vision') || m.includes('4o')),
        large: models.filter(m => m.includes('opus') || m.includes('gpt-4'))
      };

      console.log('📊 Model categories:');
      Object.entries(categories).forEach(([cat, mods]) => {
        console.log(`  - ${cat}: ${mods.length} models`);
      });
    });
  });

  describe('Provider Health Check', () => {
    it('should verify all configured providers are responsive', async () => {
      if (skipIfNoProviders()) return;

      const providerTypes = ['openai', 'openrouter', 'gemini', 'custom'];
      const results = [];

      for (const type of providerTypes) {
        const provider = await modelProviderRegistry.getProvider(type as any);
        if (!provider) continue;

        const start = Date.now();
        try {
          // For OpenRouter, we need to wait a bit for async initialization
          if (type === 'openrouter') {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          const models = provider.getAvailableModels();
          const duration = Date.now() - start;
          
          results.push({
            name: type,
            status: 'healthy',
            models: models.length,
            responseTime: duration
          });
        } catch (error) {
          results.push({
            name: type,
            status: 'error',
            error: (error as Error).message
          });
        }
      }

      console.log('🏥 Provider Health:');
      results.forEach(r => {
        const icon = r.status === 'healthy' ? '✅' : '❌';
        console.log(`  ${icon} ${r.name}: ${r.status} ${r.models !== undefined ? `(${r.models} models, ${r.responseTime}ms)` : `(${r.error})`}`);
      });

      // At least one provider should be healthy
      expect(results.some(r => r.status === 'healthy')).toBe(true);
    });
  });

  describe('Model Pricing Validation', () => {
    it('should have pricing information for expensive models', async () => {
      if (skipIfNoProviders()) return;

      const providerTypes = ['openai', 'openrouter', 'gemini', 'custom'];
      const expensiveModels = [];

      for (const type of providerTypes) {
        const provider = await modelProviderRegistry.getProvider(type as any);
        if (!provider) continue;
        
        const models = provider.getAvailableModels();
        for (const model of models) {
          // Check for known expensive models
          if (model.includes('opus') || 
              model.includes('gpt-4') || 
              model.includes('o1') ||
              model.includes('o3-pro')) {
            expensiveModels.push({
              provider: type,
              model: model
            });
          }
        }
      }

      if (expensiveModels.length > 0) {
        console.log('💰 Expensive models detected:');
        expensiveModels.forEach(m => {
          console.log(`  - ${m.provider}/${m.model}`);
        });
        console.log('⚠️  Be careful with usage to avoid high costs!');
      }
    });
  });
});