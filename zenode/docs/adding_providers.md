# Adding a New Provider to Zenode

This guide explains how to add support for a new AI model provider to the Zenode MCP Server. Follow these steps to integrate providers like Anthropic, Cohere, or any API that provides AI model access.

## Overview

The provider system in Zenode is designed to be extensible and follows TypeScript/Node.js patterns. Each provider:
- Implements the `ModelProvider` interface with TypeScript type safety
- Uses async/await patterns for better error handling
- Is registered in the provider registry system
- Has its API key configured via environment variables
- Supports proper temperature constraints and model capabilities

## Implementation Approaches

You have two main implementation options:

### Option A: Native Provider (Full TypeScript Implementation)
Implement the `ModelProvider` interface directly when:
- Your API has unique features not compatible with OpenAI's format
- You need full control over request/response handling
- You want to implement custom features like extended thinking
- You need specific error handling or retry logic

### Option B: OpenAI-Compatible Provider (Simplified)
Extend existing OpenAI-compatible patterns when:
- Your API follows OpenAI's chat completion format
- You want to reuse existing HTTP client infrastructure
- You only need to define model capabilities and endpoint configuration

## Step-by-Step Implementation Guide

### 1. Add Provider Type to Enum

First, add your provider to the `ProviderType` enum in `src/types/providers.ts`:

```typescript
export enum ProviderType {
  GOOGLE = 'google',
  OPENAI = 'openai',
  OPENROUTER = 'openrouter',
  CUSTOM = 'custom',
  EXAMPLE = 'example',  // Add your provider here
}
```

### 2. Create Provider Implementation

#### Option A: Native Provider Implementation

Create a new file in `src/providers/` (e.g., `src/providers/example.ts`):

```typescript
/**
 * Example model provider implementation for Zenode
 */

import { ModelProvider, ModelRequest, ModelResponse, ModelCapabilities, ProviderType } from '../types/providers.js';
import { logger } from '../utils/logger.js';

export class ExampleModelProvider implements ModelProvider {
  readonly type = ProviderType.EXAMPLE;
  readonly friendlyName = 'Example';

  private apiKey: string;
  private baseUrl: string;

  // Define supported models with their capabilities
  private static readonly SUPPORTED_MODELS = {
    'example-large-v1': {
      contextWindow: 100_000,
      supportsExtendedThinking: false,
      supportsImages: false,
      maxImageSizeMB: 0,
    },
    'example-small-v1': {
      contextWindow: 50_000,
      supportsExtendedThinking: false,
      supportsImages: false,
      maxImageSizeMB: 0,
    },
    // Model aliases for better user experience
    'large': 'example-large-v1',
    'small': 'example-small-v1',
  };

  constructor(apiKey: string, options: { baseUrl?: string } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = options.baseUrl || 'https://api.example.com/v1';
    
    logger.info('Example provider initialized', { 
      baseUrl: this.baseUrl,
      supportedModels: Object.keys(ExampleModelProvider.SUPPORTED_MODELS).length 
    });
  }

  async generateResponse(request: ModelRequest): Promise<ModelResponse> {
    const resolvedModel = this.resolveModelAlias(request.model) || request.model;
    
    // Validate model before making API call
    if (!this.validateModel(resolvedModel)) {
      throw new Error(`Unsupported model: ${request.model}`);
    }

    try {
      // Example API call implementation
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Example API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.choices[0].message.content,
        usage: {
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0,
        },
        modelName: resolvedModel,
        friendlyName: this.friendlyName,
        provider: this.type,
        metadata: {
          requestId: data.id,
          finishReason: data.choices[0].finish_reason,
        },
      };
      
    } catch (error) {
      logger.error('Example API call failed', { 
        model: resolvedModel, 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  getAvailableModels(): string[] {
    return Object.keys(ExampleModelProvider.SUPPORTED_MODELS).filter(
      model => typeof ExampleModelProvider.SUPPORTED_MODELS[model] === 'object'
    );
  }

  getModelCapabilities(modelName: string): ModelCapabilities | null {
    const resolvedName = this.resolveModelAlias(modelName) || modelName;
    const config = ExampleModelProvider.SUPPORTED_MODELS[resolvedName];
    
    if (!config || typeof config === 'string') {
      return null;
    }

    return {
      provider: this.type,
      modelName: resolvedName,
      friendlyName: this.friendlyName,
      contextWindow: config.contextWindow,
      supportsExtendedThinking: config.supportsExtendedThinking,
      supportsSystemPrompts: true,
      supportsStreaming: false,
      supportsFunctionCalling: true,
      supportsImages: config.supportsImages,
      maxImageSizeMB: config.maxImageSizeMB,
      temperatureConstraint: {
        validate: (temp: number) => temp >= 0.0 && temp <= 2.0,
        getCorrectedValue: (temp: number) => Math.max(0.0, Math.min(2.0, temp)),
        getDescription: () => 'Temperature must be between 0.0 and 2.0',
        getDefault: () => 0.7,
      },
    };
  }

  validateModel(modelName: string): boolean {
    const resolvedName = this.resolveModelAlias(modelName) || modelName;
    const config = ExampleModelProvider.SUPPORTED_MODELS[resolvedName];
    return config !== undefined && typeof config === 'object';
  }

  resolveModelAlias(alias: string): string | null {
    const resolved = ExampleModelProvider.SUPPORTED_MODELS[alias];
    return typeof resolved === 'string' ? resolved : null;
  }

  async getImageCapabilities(modelName: string): Promise<import('../types/images.js').ImageCapabilities> {
    const capabilities = this.getModelCapabilities(modelName);
    
    return {
      supportsImages: capabilities?.supportsImages || false,
      maxImageSizeMB: capabilities?.maxImageSizeMB || 0,
      supportedFormats: capabilities?.supportsImages ? ['png', 'jpg', 'jpeg', 'gif', 'webp'] : [],
      maxImagesPerRequest: capabilities?.supportsImages ? 10 : 0,
    };
  }
}
```

### 3. Register Provider in Registry

Update `src/providers/registry.ts` to include your provider:

```typescript
import { ExampleModelProvider } from './example.js';

// Add to the factory functions
export const providerFactories: Record<ProviderType, ProviderFactory> = {
  [ProviderType.GOOGLE]: (apiKey?: string) => new GeminiModelProvider(apiKey!),
  [ProviderType.OPENAI]: (apiKey?: string) => new OpenAIModelProvider(apiKey!),
  [ProviderType.OPENROUTER]: (apiKey?: string) => new OpenRouterProvider(apiKey!),
  [ProviderType.CUSTOM]: (apiKey?: string) => new CustomModelProvider(apiKey || ''),
  [ProviderType.EXAMPLE]: (apiKey?: string) => new ExampleModelProvider(apiKey!), // Add this
};

// Add API key environment variable mapping
const getApiKeyForProvider = (providerType: ProviderType): string | undefined => {
  const keyMapping = {
    [ProviderType.GOOGLE]: process.env.GEMINI_API_KEY,
    [ProviderType.OPENAI]: process.env.OPENAI_API_KEY,
    [ProviderType.OPENROUTER]: process.env.OPENROUTER_API_KEY,
    [ProviderType.CUSTOM]: process.env.CUSTOM_API_KEY,
    [ProviderType.EXAMPLE]: process.env.EXAMPLE_API_KEY, // Add this
  };
  
  return keyMapping[providerType];
};
```

### 4. Update Configuration

Add your models to `src/config.ts` for auto mode selection:

```typescript
export const MODEL_CAPABILITIES_DESC: Record<string, string> = {
  // ... existing models ...
  
  // Example models - Available when EXAMPLE_API_KEY is configured
  'large': 'Example Large (100K context) - High capacity model for complex tasks',
  'small': 'Example Small (50K context) - Fast model for simple tasks',
  // Full model names
  'example-large-v1': 'Example Large (100K context) - High capacity model',
  'example-small-v1': 'Example Small (50K context) - Fast lightweight model',
};
```

Add configuration helper:

```typescript
// Add to config.ts
export const EXAMPLE_API_KEY = process.env.EXAMPLE_API_KEY;

// Update getConfiguredProviders function
export function getConfiguredProviders(): string[] {
  const providers: string[] = [];
  
  if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    providers.push('Gemini');
  }
  
  if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
    providers.push('OpenAI');
  }
  
  if (OPENROUTER_API_KEY && OPENROUTER_API_KEY !== 'your_openrouter_api_key_here') {
    providers.push('OpenRouter');
  }
  
  if (EXAMPLE_API_KEY && EXAMPLE_API_KEY !== 'your_example_api_key_here') {
    providers.push('Example'); // Add this
  }
  
  if (CUSTOM_API_URL) {
    providers.push(`Custom (${CUSTOM_API_URL})`);
  }
  
  return providers;
}
```

### 5. Update Environment Configuration

Add to `zenode/.env.example`:

```bash
# Example API Configuration
EXAMPLE_API_KEY=your_example_api_key_here

# Optional: Restrict which Example models can be used
EXAMPLE_ALLOWED_MODELS=large,small,example-large-v1
```

### 6. Write Tests

Create `src/providers/__tests__/example.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExampleModelProvider } from '../example.js';
import { ProviderType } from '../../types/providers.js';

describe('ExampleModelProvider', () => {
  let provider: ExampleModelProvider;

  beforeEach(() => {
    provider = new ExampleModelProvider('test-api-key');
  });

  describe('initialization', () => {
    it('should initialize with correct type and name', () => {
      expect(provider.type).toBe(ProviderType.EXAMPLE);
      expect(provider.friendlyName).toBe('Example');
    });
  });

  describe('model validation', () => {
    it('should validate supported models', () => {
      expect(provider.validateModel('large')).toBe(true);
      expect(provider.validateModel('example-large-v1')).toBe(true);
      expect(provider.validateModel('small')).toBe(true);
      expect(provider.validateModel('invalid-model')).toBe(false);
    });
  });

  describe('model alias resolution', () => {
    it('should resolve aliases to full model names', () => {
      expect(provider.resolveModelAlias('large')).toBe('example-large-v1');
      expect(provider.resolveModelAlias('small')).toBe('example-small-v1');
      expect(provider.resolveModelAlias('example-large-v1')).toBeNull();
    });
  });

  describe('model capabilities', () => {
    it('should return correct capabilities for supported models', () => {
      const capabilities = provider.getModelCapabilities('large');
      expect(capabilities).toBeTruthy();
      expect(capabilities?.modelName).toBe('example-large-v1');
      expect(capabilities?.contextWindow).toBe(100_000);
      expect(capabilities?.provider).toBe(ProviderType.EXAMPLE);
    });

    it('should return null for unsupported models', () => {
      const capabilities = provider.getModelCapabilities('invalid-model');
      expect(capabilities).toBeNull();
    });
  });
});
```

### 7. Update Documentation

#### 7.1. Update zenode/README.md

Add your provider to the quickstart section:

```markdown
### 1. Get API Keys (at least one required)

**Option B: Native APIs**
- **Gemini**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
- **OpenAI**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
- **Example**: Visit [Example API Console](https://example.com/api-keys)  # Add this
```

### 8. Test with Real API

Create a test script `scripts/test-example-provider.js`:

```javascript
#!/usr/bin/env node

import { ExampleModelProvider } from '../dist/providers/example.js';

async function testExampleProvider() {
  const apiKey = process.env.EXAMPLE_API_KEY;
  
  if (!apiKey || apiKey === 'your_example_api_key_here') {
    console.log('❌ EXAMPLE_API_KEY not configured');
    return;
  }

  try {
    console.log('🔧 Testing Example provider...');
    
    const provider = new ExampleModelProvider(apiKey);
    
    // Test model validation
    console.log('✅ Large model valid:', provider.validateModel('large'));
    console.log('✅ Alias resolution:', provider.resolveModelAlias('large'));
    
    // Test capabilities
    const capabilities = provider.getModelCapabilities('large');
    console.log('✅ Model capabilities:', capabilities?.contextWindow, 'tokens');
    
    // Test API call
    const response = await provider.generateResponse({
      model: 'large',
      messages: [{ role: 'user', content: 'Say hello!' }],
      temperature: 0.1,
    });
    
    console.log('✅ API Response:', response.content.substring(0, 100));
    console.log('✅ Token usage:', response.usage);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testExampleProvider();
```

### 9. Integration with Zenode Tools

Your provider will automatically work with all zenode tools once registered. Users can invoke it using:

```bash
# Using :z coordination
:z "coordinate with zenode:chat using Example's large model to analyze this architecture decision"

# Direct tool usage
zenode:chat "Analyze this code structure" --model large --files ["/workspace/src/app.ts"]

# Auto mode will include your models
zenode:thinkdeep "Deep analysis needed" --model auto
```

## Testing Your Provider

### Unit Tests
```bash
cd zenode
npm test -- example
```

### Integration Tests
```bash
# Set your API key
export EXAMPLE_API_KEY=your_actual_key

# Test the provider directly
node scripts/test-example-provider.js

# Test through zenode tools
zenode:chat "test message" --model large
```

### Using with Claude Code

Add to your `.env`:
```bash
EXAMPLE_API_KEY=your_actual_api_key_here
```

Restart the zenode Docker containers:
```bash
cd zenode
docker-compose restart
```

Test the integration:
```bash
zenode:version  # Should show Example in configured providers
```

## Best Practices for Zenode

1. **Use TypeScript properly**: Leverage interfaces and type safety
2. **Handle async operations**: Use proper async/await with error handling
3. **Follow naming conventions**: Use camelCase for TypeScript, kebab-case for configs
4. **Log appropriately**: Use the logger utility for debugging and monitoring
5. **Support model aliases**: Make the user experience friendly with shortcuts
6. **Validate thoroughly**: Check API keys, model names, and parameters
7. **Handle errors gracefully**: Provide meaningful error messages
8. **Test extensively**: Unit tests, integration tests, and real API calls

## Checklist

Before submitting your provider:

- [ ] Provider type added to `ProviderType` enum
- [ ] Provider implementation follows TypeScript interfaces
- [ ] Provider registered in registry with factory function
- [ ] API key mapping added to configuration
- [ ] Model capabilities defined in config.js
- [ ] Environment variables documented in .env.example
- [ ] Unit tests written and passing
- [ ] Integration test script created
- [ ] Documentation updated (README.md)
- [ ] Real API testing completed
- [ ] Error handling verified
- [ ] Model alias resolution works correctly
- [ ] Temperature constraints properly implemented
- [ ] Image capabilities defined (if supported)

## Need Help?

- Check existing providers in `src/providers/` for examples
- Review the TypeScript interfaces in `src/types/providers.ts`
- Test frequently during development
- Use `:z "help me debug this provider implementation"` for assistance
- Create GitHub issues for complex implementation questions

The zenode architecture makes provider development straightforward with TypeScript type safety and comprehensive tooling support.