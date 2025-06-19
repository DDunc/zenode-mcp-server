/**
 * List Models Tool - Display all available models organized by provider
 *
 * This tool provides a comprehensive view of all AI models available in the system,
 * organized by their provider (Gemini, OpenAI, X.AI, OpenRouter, Custom).
 * It shows which providers are configured and what models can be used.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolModelCategory, ToolOutput } from '../types/tools.js';
import { logger } from '../utils/logger.js';
import { getConfiguredProviders } from '../config.js';
import { BaseToolRequestSchema } from '../utils/schema-helpers.js';

// Zod schema for request validation
const ListModelsRequestSchema = BaseToolRequestSchema.extend({
  // No additional parameters required for this utility tool
});

type ListModelsRequest = z.infer<typeof ListModelsRequestSchema>;

export class ListModelsTool extends BaseTool {
  name = 'listmodels';
  description = `LIST AVAILABLE MODELS - Display all AI models organized by provider. Shows which providers are configured, available models, their aliases, context windows, and capabilities. Useful for understanding what models can be used and their characteristics.`;
  
  defaultTemperature = 0.0; // Not used for this utility tool
  modelCategory = ToolModelCategory.FAST;

  getZodSchema() {
    return ListModelsRequestSchema;
  }

  getSystemPrompt(): string {
    return ''; // No AI model needed for this tool
  }

  async execute(args: ListModelsRequest): Promise<ToolOutput> {
    const validated = ListModelsRequestSchema.parse(args);

    logger.debug('[LISTMODELS] Generating comprehensive model listing');

    const outputLines: string[] = ['# Available AI Models\n'];

    // Check native providers
    const nativeProviders = {
      gemini: {
        name: 'Google Gemini',
        envKey: 'GEMINI_API_KEY',
        models: {
          flash: 'gemini-2.5-flash-preview-05-20',
          pro: 'gemini-2.5-pro-preview-06-05',
        },
      },
      openai: {
        name: 'OpenAI',
        envKey: 'OPENAI_API_KEY',
        models: {
          o3: 'o3',
          'o3-mini': 'o3-mini',
          'o3-pro': 'o3-pro',
          'o4-mini': 'o4-mini',
          'o4-mini-high': 'o4-mini-high',
        },
      },
      xai: {
        name: 'X.AI (Grok)',
        envKey: 'XAI_API_KEY',
        models: {
          grok: 'grok-3',
          'grok-3': 'grok-3',
          'grok-3-fast': 'grok-3-fast',
          grok3: 'grok-3',
          grokfast: 'grok-3-fast',
        },
      },
    };

    // Model capability descriptions
    const modelDescriptions: Record<string, string> = {
      flash: 'Ultra-fast (1M context) - Quick analysis, simple queries, rapid iterations',
      pro: 'Deep reasoning + thinking mode (1M context) - Complex problems, architecture, deep analysis',
      o3: 'Strong reasoning (200K context) - Logical problems, code generation, systematic analysis',
      'o3-mini': 'Fast O3 variant (200K context) - Balanced performance/speed, moderate complexity',
      'o3-pro': 'Professional-grade reasoning (200K context) - ⚠️ EXTREMELY EXPENSIVE: Only for the most complex problems',
      'o4-mini': 'Latest reasoning model (200K context) - Optimized for shorter contexts, rapid reasoning',
      'o4-mini-high': 'Enhanced O4 mini (200K context) - Higher reasoning effort for complex tasks',
      grok: 'X.AI reasoning model - Alternative AI provider with unique perspective',
      'grok-3': 'Latest Grok model - Advanced reasoning capabilities',
      'grok-3-fast': 'Fast Grok variant - Optimized for speed',
    };

    // Check each native provider
    for (const [providerKey, providerInfo] of Object.entries(nativeProviders)) {
      const isConfigured = process.env[providerInfo.envKey] && 
        process.env[providerInfo.envKey] !== `your_${providerKey}_api_key_here`;

      outputLines.push(`## ${providerInfo.name} ${isConfigured ? '✅' : '❌'}`);

      if (isConfigured) {
        outputLines.push('**Status**: Configured and available');
        outputLines.push('\n**Models**:');

        for (const [alias, fullName] of Object.entries(providerInfo.models)) {
          const description = modelDescriptions[alias] || '';
          outputLines.push(`- \`${alias}\` → \`${fullName}\``);
          if (description) {
            outputLines.push(`  - ${description}`);
          }
        }
      } else {
        outputLines.push(`**Status**: Not configured (set ${providerInfo.envKey})`);
      }

      outputLines.push('');
    }

    // Check OpenRouter
    const isOpenRouterConfigured = process.env.OPENROUTER_API_KEY && 
      process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';
    outputLines.push(`## OpenRouter ${isOpenRouterConfigured ? '✅' : '❌'}`);

    if (isOpenRouterConfigured) {
      outputLines.push('**Status**: Configured and available');
      outputLines.push('**Description**: Access to multiple cloud AI providers via unified API');

      try {
        // Simplified model listing - just show that OpenRouter is available
        outputLines.push('\n**Available Models**: Access to GPT-4, Claude, Mistral, and many others');
        outputLines.push('Run the tool after setting OPENROUTER_API_KEY to see specific models');
      } catch (error) {
        outputLines.push(`**Error loading models**: ${error}`);
      }
    } else {
      outputLines.push('**Status**: Not configured (set OPENROUTER_API_KEY)');
      outputLines.push('**Note**: Provides access to GPT-4, Claude, Mistral, and many more');
    }

    outputLines.push('');

    // Check Custom API
    const customUrl = process.env.CUSTOM_API_URL;
    outputLines.push(`## Custom/Local API ${customUrl ? '✅' : '❌'}`);

    if (customUrl) {
      outputLines.push('**Status**: Configured and available');
      outputLines.push(`**Endpoint**: ${customUrl}`);
      outputLines.push('**Description**: Local models via Ollama, vLLM, LM Studio, etc.');

      try {
        // Simplified custom model listing
        outputLines.push('\n**Custom Models**: Available when CUSTOM_API_URL is configured');
        outputLines.push('Supports Ollama, vLLM, LM Studio, and other OpenAI-compatible APIs');
      } catch (error) {
        outputLines.push(`**Error loading custom models**: ${error}`);
      }
    } else {
      outputLines.push('**Status**: Not configured (set CUSTOM_API_URL)');
      outputLines.push('**Example**: CUSTOM_API_URL=http://localhost:11434 (for Ollama)');
    }

    outputLines.push('');

    // Add summary
    outputLines.push('## Summary');

    // Count configured providers
    const configuredProviders = getConfiguredProviders();
    outputLines.push(`**Configured Providers**: ${configuredProviders.length}`);

    // Note about total available models
    outputLines.push('**Total Available Models**: Depends on configured providers');

    // Add usage tips
    outputLines.push('\n**Usage Tips**:');
    outputLines.push('- Use model aliases (e.g., \'flash\', \'o3\', \'opus\') for convenience');
    outputLines.push('- In auto mode, Claude will select the best model for each task');
    outputLines.push('- Custom models are only available when CUSTOM_API_URL is set');
    outputLines.push('- OpenRouter provides access to many cloud models with one API key');

    // Format output
    const content = outputLines.join('\n');

    logger.info(`[LISTMODELS] Generated model listing with ${configuredProviders.length} configured providers`);

    return this.formatOutput(content);
  }
}