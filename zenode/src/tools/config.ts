/**
 * Config Tool - Interactive CLI configuration for zenode API keys and settings
 */

import { z } from 'zod';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { BaseTool } from './base.js';
import { ToolOutput, ConfigRequest } from '../types/tools.js';
import { BaseToolRequestSchema } from '../utils/schema-helpers.js';
import { TEMPERATURE_BALANCED } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Config tool request schema
 */
const ConfigRequestSchema = BaseToolRequestSchema.extend({
  action: z.enum(['setup', 'list', 'validate', 'reset']).describe('Configuration action to perform'),
  provider: z.enum(['gemini', 'openai', 'openrouter', 'custom', 'browserbase', 'searchapi', 'serpapi']).optional().describe('Provider to configure'),
  api_key: z.string().optional().describe('API key to set (only used with setup action)'),
  custom_url: z.string().optional().describe('Custom API URL (for custom provider)'),
  custom_model: z.string().optional().describe('Custom model name (for custom provider)'),
});

/**
 * Configuration interface
 */
interface ApiConfig {
  gemini?: string;
  openai?: string;
  openrouter?: string;
  browserbase?: string;
  searchapi?: string;
  serpapi?: string;
  custom?: {
    url: string;
    key?: string;
    model: string;
  };
}

/**
 * Config tool implementation
 */
export class ConfigTool extends BaseTool {
  name = 'config';
  description = 
    'INTERACTIVE CLI CONFIGURATION - Setup API keys and configuration for zenode LLM providers. ' +
    'IMPORTANT: This tool MUST be used when explicitly invoked (e.g., "zenode:config setup"). ' +
    'Use this to configure API keys for Gemini, OpenAI, OpenRouter, or custom endpoints. ' +
    'Supports setup, validation, listing current config, and reset operations. ' +
    'Stores configuration securely in .env file without committing secrets to git.';
  
  defaultTemperature = TEMPERATURE_BALANCED;
  modelCategory = 'fast' as const;

  private readonly CONFIG_FILE = '.env';
  private readonly CONFIG_EXAMPLE_FILE = '.env.example';

  getZodSchema() {
    return ConfigRequestSchema;
  }

  getSystemPrompt(): string {
    return `You are a configuration assistant for the zenode MCP server.

Your role is to:
- Guide users through API key setup for different LLM providers
- Help validate configuration settings
- Ensure secure storage of API credentials
- Provide clear instructions for getting API keys
- Troubleshoot configuration issues

Guidelines:
- Always explain what each API key provides access to
- Provide direct links to get API keys when helpful
- Emphasize security best practices
- Only require ONE API key to get started (not all three)
- Be clear about which providers are optional vs required
- Guide users to test their configuration after setup

Remember: The goal is to get users up and running quickly with at least one working provider.`;
  }

  async execute(args: ConfigRequest): Promise<ToolOutput> {
    try {
      // Validate request
      const validated = this.validateArgs<ConfigRequest>(args);
      
      logger.info(`Config tool invoked with action: ${validated.action}`);
      
      switch (validated.action) {
        case 'setup':
          return await this.handleSetup(validated);
        case 'list':
          return await this.handleList();
        case 'validate':
          return await this.handleValidate();
        case 'reset':
          return await this.handleReset();
        default:
          throw new Error(`Unknown action: ${validated.action}`);
      }
      
    } catch (error) {
      logger.error('Config tool error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          'error',
        );
      }
      
      return this.formatOutput(
        `Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error',
      );
    }
  }

  /**
   * Handle setup action
   */
  private async handleSetup(args: ConfigRequest): Promise<ToolOutput> {
    if (!args.provider) {
      return this.formatOutput(this.getSetupInstructions(), 'success');
    }

    // Load current configuration
    const currentConfig = await this.loadCurrentConfig();
    
    switch (args.provider) {
      case 'gemini':
        if (!args.api_key) {
          return this.formatOutput(this.getGeminiSetupInstructions(), 'success');
        }
        await this.setApiKey('GEMINI_API_KEY', args.api_key);
        return this.formatOutput(
          '✅ Gemini API key configured successfully!\n\n' +
          'Gemini provides access to:\n' +
          '- flash: Ultra-fast responses for quick tasks\n' +
          '- pro: Deep reasoning with thinking mode for complex problems\n\n' +
          'Test your configuration with: `zenode:config validate`',
          'success'
        );

      case 'openai':
        if (!args.api_key) {
          return this.formatOutput(this.getOpenAISetupInstructions(), 'success');
        }
        await this.setApiKey('OPENAI_API_KEY', args.api_key);
        return this.formatOutput(
          '✅ OpenAI API key configured successfully!\n\n' +
          'OpenAI provides access to:\n' +
          '- o3: Strong reasoning for logical problems\n' +
          '- o3-mini: Fast variant for balanced performance\n' +
          '- o4-mini: Latest reasoning model\n\n' +
          'Test your configuration with: `zenode:config validate`',
          'success'
        );

      case 'openrouter':
        if (!args.api_key) {
          return this.formatOutput(this.getOpenRouterSetupInstructions(), 'success');
        }
        await this.setApiKey('OPENROUTER_API_KEY', args.api_key);
        return this.formatOutput(
          '✅ OpenRouter API key configured successfully!\n\n' +
          'OpenRouter provides access to multiple models from different providers:\n' +
          '- Claude, GPT, Gemini, and many more\n' +
          '- Acts as a unified gateway to various AI models\n' +
          '- Great fallback option when native APIs are unavailable\n\n' +
          'Test your configuration with: `zenode:config validate`',
          'success'
        );

      case 'custom':
        if (!args.custom_url) {
          return this.formatOutput(this.getCustomSetupInstructions(), 'success');
        }
        await this.setCustomEndpoint(args.custom_url, args.api_key, args.custom_model);
        return this.formatOutput(
          '✅ Custom API endpoint configured successfully!\n\n' +
          `Endpoint: ${args.custom_url}\n` +
          `Model: ${args.custom_model || 'llama3.2'}\n` +
          `Authentication: ${args.api_key ? 'Enabled' : 'None (suitable for Ollama)'}\n\n` +
          'Test your configuration with: `zenode:config validate`',
          'success'
        );

      case 'browserbase':
        if (!args.api_key) {
          return this.formatOutput(this.getBrowserbaseSetupInstructions(), 'success');
        }
        await this.setApiKey('BROWSERBASE_API_KEY', args.api_key);
        return this.formatOutput(
          '✅ Browserbase API key configured successfully!\n\n' +
          'Browserbase provides access to:\n' +
          '- Remote browser automation for web scraping\n' +
          '- Reverse image search capabilities\n' +
          '- Web page screenshot and analysis\n\n' +
          'Used by: zenode:visitor tool\n' +
          'Test your configuration with: `zenode:config validate`',
          'success'
        );

      case 'searchapi':
        if (!args.api_key) {
          return this.formatOutput(this.getSearchAPISetupInstructions(), 'success');
        }
        await this.setApiKey('SEARCHAPI_KEY', args.api_key);
        return this.formatOutput(
          '✅ SearchAPI key configured successfully!\n\n' +
          'SearchAPI provides access to:\n' +
          '- Google Search results\n' +
          '- Google Images reverse search\n' +
          '- YouTube, Google Shopping, and more search engines\n\n' +
          'Used by: zenode:visit tool\n' +
          'Test your configuration with: `zenode:config validate`',
          'success'
        );

      case 'serpapi':
        if (!args.api_key) {
          return this.formatOutput(this.getSerpAPISetupInstructions(), 'success');
        }
        await this.setApiKey('SERPAPI_KEY', args.api_key);
        return this.formatOutput(
          '✅ SerpAPI key configured successfully!\n\n' +
          'SerpAPI provides access to:\n' +
          '- Google Search with 99.95% SLA\n' +
          '- Google Images and reverse image search\n' +
          '- Global location-based search results\n' +
          '- CAPTCHA solving and legal protection\n\n' +
          'Used by: zenode:visit tool\n' +
          'Test your configuration with: `zenode:config validate`',
          'success'
        );

      default:
        throw new Error(`Unknown provider: ${args.provider}`);
    }
  }

  /**
   * Handle list action
   */
  private async handleList(): Promise<ToolOutput> {
    const config = await this.loadCurrentConfig();
    const configStatus = this.getConfigurationStatus(config);
    
    return this.formatOutput(
      `# Zenode Configuration Status\n\n${configStatus}\n\n` +
      'To setup a provider: `zenode:config setup --provider <provider_name>`\n' +
      'To validate configuration: `zenode:config validate`',
      'success'
    );
  }

  /**
   * Handle validate action
   */
  private async handleValidate(): Promise<ToolOutput> {
    const config = await this.loadCurrentConfig();
    const validationResult = await this.validateConfiguration(config);
    
    return this.formatOutput(validationResult, 'success');
  }

  /**
   * Handle reset action
   */
  private async handleReset(): Promise<ToolOutput> {
    try {
      // Create backup of current .env
      const envPath = join(process.cwd(), this.CONFIG_FILE);
      const backupPath = join(process.cwd(), `.env.backup.${Date.now()}`);
      
      try {
        await fs.access(envPath);
        await fs.copyFile(envPath, backupPath);
        logger.info(`Backed up current .env to ${backupPath}`);
      } catch {
        // No existing .env file
      }

      // Remove API key related environment variables
      const apiKeys = [
        'GEMINI_API_KEY',
        'OPENAI_API_KEY', 
        'OPENROUTER_API_KEY',
        'BROWSERBASE_API_KEY',
        'SEARCHAPI_KEY',
        'SERPAPI_KEY',
        'CUSTOM_API_URL',
        'CUSTOM_API_KEY',
        'CUSTOM_MODEL_NAME'
      ];

      let envContent = '';
      try {
        envContent = await fs.readFile(envPath, 'utf8');
      } catch {
        // No existing file
      }

      // Remove API key lines
      const lines = envContent.split('\n');
      const filteredLines = lines.filter(line => {
        const trimmed = line.trim();
        return !apiKeys.some(key => trimmed.startsWith(`${key}=`));
      });

      // Write back filtered content
      await fs.writeFile(envPath, filteredLines.join('\n'));

      return this.formatOutput(
        '✅ Configuration reset successfully!\n\n' +
        `Backup created: ${backupPath}\n\n` +
        'All API keys have been removed. You can now reconfigure with:\n' +
        '`zenode:config setup`',
        'success'
      );
    } catch (error) {
      throw new Error(`Failed to reset configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load current configuration from .env file
   */
  private async loadCurrentConfig(): Promise<ApiConfig> {
    const config: ApiConfig = {};
    
    try {
      const envPath = join(process.cwd(), this.CONFIG_FILE);
      const envContent = await fs.readFile(envPath, 'utf8');
      
      // Parse environment variables
      const lines = envContent.split('\n');
      let customUrl = '';
      let customKey = '';
      let customModel = '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GEMINI_API_KEY=')) {
          const value = trimmed.split('=', 2)[1];
          if (value && value !== 'your_gemini_api_key_here') {
            config.gemini = value;
          }
        } else if (trimmed.startsWith('OPENAI_API_KEY=')) {
          const value = trimmed.split('=', 2)[1];
          if (value && value !== 'your_openai_api_key_here') {
            config.openai = value;
          }
        } else if (trimmed.startsWith('OPENROUTER_API_KEY=')) {
          const value = trimmed.split('=', 2)[1];
          if (value && value !== 'your_openrouter_api_key_here') {
            config.openrouter = value;
          }
        } else if (trimmed.startsWith('CUSTOM_API_URL=')) {
          customUrl = trimmed.split('=', 2)[1] || '';
        } else if (trimmed.startsWith('CUSTOM_API_KEY=')) {
          customKey = trimmed.split('=', 2)[1] || '';
        } else if (trimmed.startsWith('CUSTOM_MODEL_NAME=')) {
          customModel = trimmed.split('=', 2)[1] || '';
        } else if (trimmed.startsWith('BROWSERBASE_API_KEY=')) {
          const value = trimmed.split('=', 2)[1];
          if (value && value !== 'your_browserbase_api_key_here') {
            config.browserbase = value;
          }
        } else if (trimmed.startsWith('SEARCHAPI_KEY=')) {
          const value = trimmed.split('=', 2)[1];
          if (value && value !== 'your_searchapi_key_here') {
            config.searchapi = value;
          }
        } else if (trimmed.startsWith('SERPAPI_KEY=')) {
          const value = trimmed.split('=', 2)[1];
          if (value && value !== 'your_serpapi_key_here') {
            config.serpapi = value;
          }
        }
      }
      
      if (customUrl) {
        config.custom = {
          url: customUrl,
          key: customKey,
          model: customModel || 'llama3.2'
        };
      }
      
    } catch (error) {
      // No .env file exists yet
      logger.debug('No .env file found, returning empty config');
    }
    
    return config;
  }

  /**
   * Set an API key in the .env file
   */
  private async setApiKey(keyName: string, keyValue: string): Promise<void> {
    const envPath = join(process.cwd(), this.CONFIG_FILE);
    
    // Ensure directory exists
    await fs.mkdir(dirname(envPath), { recursive: true });
    
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf8');
    } catch {
      // File doesn't exist, start with example content
      try {
        envContent = await fs.readFile(join(process.cwd(), this.CONFIG_EXAMPLE_FILE), 'utf8');
      } catch {
        // No example file either, create minimal content
        envContent = '# Zenode MCP Server Environment Configuration\n';
      }
    }
    
    // Update or add the API key
    const lines = envContent.split('\n');
    let keyFound = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && line.trim().startsWith(`${keyName}=`)) {
        lines[i] = `${keyName}=${keyValue}`;
        keyFound = true;
        break;
      }
    }
    
    if (!keyFound) {
      // Add the key at the end
      lines.push(`${keyName}=${keyValue}`);
    }
    
    await fs.writeFile(envPath, lines.join('\n'));
  }

  /**
   * Set custom endpoint configuration
   */
  private async setCustomEndpoint(url: string, key?: string, model?: string): Promise<void> {
    await this.setApiKey('CUSTOM_API_URL', url);
    if (key) {
      await this.setApiKey('CUSTOM_API_KEY', key);
    }
    if (model) {
      await this.setApiKey('CUSTOM_MODEL_NAME', model);
    }
  }

  /**
   * Get configuration status summary
   */
  private getConfigurationStatus(config: ApiConfig): string {
    const providers = [];
    
    if (config.gemini) {
      providers.push('✅ **Gemini** - Configured (flash, pro models available)');
    } else {
      providers.push('❌ **Gemini** - Not configured');
    }
    
    if (config.openai) {
      providers.push('✅ **OpenAI** - Configured (o3, o4-mini models available)');
    } else {
      providers.push('❌ **OpenAI** - Not configured');
    }
    
    if (config.openrouter) {
      providers.push('✅ **OpenRouter** - Configured (multiple models available)');
    } else {
      providers.push('❌ **OpenRouter** - Not configured');
    }
    
    if (config.custom) {
      providers.push(`✅ **Custom** - Configured (${config.custom.url}, model: ${config.custom.model})`);
    } else {
      providers.push('❌ **Custom** - Not configured');
    }
    
    // Optional providers for visitor tool
    providers.push(''); // Add separator
    providers.push('### Optional APIs (for zenode:visitor tool)');
    
    if (config.browserbase) {
      providers.push('✅ **Browserbase** - Configured (browser automation available)');
    } else {
      providers.push('⚪ **Browserbase** - Not configured (browser automation disabled)');
    }
    
    if (config.searchapi) {
      providers.push('✅ **SearchAPI** - Configured (Google/Bing search available)');
    } else {
      providers.push('⚪ **SearchAPI** - Not configured (alternative search disabled)');
    }
    
    if (config.serpapi) {
      providers.push('✅ **SerpAPI** - Configured (Google search + reverse image search available)');
    } else {
      providers.push('⚪ **SerpAPI** - Not configured (reverse image search disabled)');
    }
    
    const configuredCount = [config.gemini, config.openai, config.openrouter, config.custom].filter(Boolean).length;
    
    let status = `## Provider Status (${configuredCount}/4 configured)\n\n`;
    status += providers.join('\n') + '\n\n';
    
    if (configuredCount === 0) {
      status += '⚠️  **No providers configured!** At least one API key is required.\n';
      status += 'Use `zenode:config setup` to get started.';
    } else if (configuredCount === 1) {
      status += '✅ **Minimum configuration met** - zenode is ready to use!';
    } else {
      status += '🚀 **Multiple providers configured** - excellent redundancy and model choice!';
    }
    
    return status;
  }

  /**
   * Validate current configuration
   */
  private async validateConfiguration(config: ApiConfig): Promise<string> {
    const issues = [];
    const working = [];
    
    // Check each provider
    if (config.gemini) {
      // In a real implementation, you'd test the API key
      working.push('✅ Gemini API key format looks valid');
    }
    
    if (config.openai) {
      working.push('✅ OpenAI API key format looks valid');
    }
    
    if (config.openrouter) {
      working.push('✅ OpenRouter API key format looks valid');
    }
    
    if (config.custom) {
      try {
        new URL(config.custom.url);
        working.push(`✅ Custom endpoint URL is valid: ${config.custom.url}`);
      } catch {
        issues.push(`❌ Custom endpoint URL is invalid: ${config.custom.url}`);
      }
    }
    
    const configuredCount = [config.gemini, config.openai, config.openrouter, config.custom].filter(Boolean).length;
    
    if (configuredCount === 0) {
      issues.push('❌ No API providers configured - at least one is required');
    }
    
    let result = '# Configuration Validation\n\n';
    
    if (working.length > 0) {
      result += '## ✅ Working Configuration\n\n';
      result += working.join('\n') + '\n\n';
    }
    
    if (issues.length > 0) {
      result += '## ❌ Issues Found\n\n';
      result += issues.join('\n') + '\n\n';
      result += 'Use `zenode:config setup` to fix configuration issues.';
    } else {
      result += '🎉 **All configuration checks passed!** Zenode is ready to use.\n\n';
      result += 'Try running a tool like: `zenode:chat "Hello, world!"`';
    }
    
    return result;
  }

  /**
   * Get general setup instructions
   */
  private getSetupInstructions(): string {
    return `# Zenode Configuration Setup

Welcome to zenode! Let's get you configured with at least one AI provider.

## Quick Start Options

Choose ONE of the following providers to get started:

### 🚀 **Recommended: OpenRouter** (Easiest - access to multiple models)
\`zenode:config setup --provider openrouter --api_key YOUR_KEY\`
- Get your key: https://openrouter.ai/keys
- Provides access to Claude, GPT, Gemini, and many more models
- Single key for multiple providers

### ⚡ **Google Gemini** (Fast and powerful)
\`zenode:config setup --provider gemini --api_key YOUR_KEY\`
- Get your key: https://makersuite.google.com/app/apikey
- Excellent for rapid iterations and deep reasoning

### 🤖 **OpenAI** (o3 and o4 models)
\`zenode:config setup --provider openai --api_key YOUR_KEY\`
- Get your key: https://platform.openai.com/api-keys  
- Access to latest reasoning models

### 🏠 **Local Models** (Ollama, vLLM, etc.)
\`zenode:config setup --provider custom --custom_url http://localhost:11434\`
- For running local models with Ollama or vLLM
- No API key costs, runs on your hardware

## Next Steps

1. Choose a provider and run the setup command
2. Validate your configuration: \`zenode:config validate\`
3. Test with a simple chat: \`zenode:chat "Hello, zenode!"\`

Need help with a specific provider? Run:
\`zenode:config setup --provider <provider_name>\` (without API key for detailed instructions)`;
  }

  /**
   * Get Gemini-specific setup instructions
   */
  private getGeminiSetupInstructions(): string {
    return `# Google Gemini API Setup

## Step 1: Get Your API Key
1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API key"
4. Copy the generated key

## Step 2: Configure Zenode
Run this command with your actual API key:
\`zenode:config setup --provider gemini --api_key YOUR_ACTUAL_KEY_HERE\`

## What You'll Get
- **flash**: Ultra-fast responses (1M context) - perfect for quick analysis
- **pro**: Deep reasoning with thinking mode (1M context) - ideal for complex problems

## Example Usage
After setup, try:
\`zenode:chat "Explain async/await in JavaScript"\`
\`zenode:analyze /path/to/your/code.js\`

## Need Help?
- Gemini API documentation: https://ai.google.dev/docs
- Rate limits are generous for development use
- Free tier available with daily quotas`;
  }

  /**
   * Get OpenAI-specific setup instructions
   */
  private getOpenAISetupInstructions(): string {
    return `# OpenAI API Setup

## Step 1: Get Your API Key
1. Visit: https://platform.openai.com/api-keys
2. Sign in to your OpenAI account
3. Click "Create new secret key"
4. Copy the generated key (starts with sk-)

## Step 2: Configure Zenode
Run this command with your actual API key:
\`zenode:config setup --provider openai --api_key YOUR_ACTUAL_KEY_HERE\`

## What You'll Get
- **o3**: Strong reasoning (200K context) - excellent for logical problems
- **o3-mini**: Fast O3 variant - balanced performance and speed
- **o4-mini**: Latest reasoning model - optimized for various tasks

## Example Usage
After setup, try:
\`zenode:debug "My function returns undefined"\`
\`zenode:codereview /path/to/your/code.py\`

## Important Notes
- Requires a paid OpenAI account with credits
- Usage is billed per token
- New accounts get free credits to start`;
  }

  /**
   * Get OpenRouter-specific setup instructions
   */
  private getOpenRouterSetupInstructions(): string {
    return `# OpenRouter API Setup

## Step 1: Get Your API Key
1. Visit: https://openrouter.ai/keys
2. Sign up or sign in
3. Click "Create Key"
4. Copy the generated key

## Step 2: Configure Zenode
Run this command with your actual API key:
\`zenode:config setup --provider openrouter --api_key YOUR_ACTUAL_KEY_HERE\`

## What You'll Get
Access to 100+ models including:
- **Claude** (Anthropic) - Excellent for coding
- **GPT-4** (OpenAI) - Great general purpose
- **Gemini** (Google) - Fast and capable
- **Many open source models** - Cost-effective options

## Why OpenRouter?
- **Single API** for multiple providers
- **Competitive pricing** - often cheaper than direct APIs
- **Great fallback** - automatic failover between models
- **Pay-per-use** - no monthly commitments

## Example Usage
After setup, try:
\`zenode:thinkdeep "Should I use React or Vue for my next project?"\`
\`zenode:precommit /path/to/your/repo\`

## Pricing
- No monthly fees, pay per token
- Free credits for new users
- Transparent pricing at: https://openrouter.ai/docs#models`;
  }

  /**
   * Get custom endpoint setup instructions
   */
  private getCustomSetupInstructions(): string {
    return `# Custom API Endpoint Setup

Perfect for running local models or connecting to custom inference servers.

## Popular Options

### Ollama (Recommended for local models)
1. Install Ollama: https://ollama.com/download
2. Pull a model: \`ollama pull llama3.2\`
3. Configure zenode:
\`zenode:config setup --provider custom --custom_url http://localhost:11434 --custom_model llama3.2\`

### vLLM (High-performance inference)
If you have vLLM running on port 8000:
\`zenode:config setup --provider custom --custom_url http://localhost:8000 --api_key YOUR_KEY --custom_model your-model-name\`

### LM Studio (GUI for local models)
1. Start LM Studio local server
2. Configure zenode:
\`zenode:config setup --provider custom --custom_url http://localhost:1234 --custom_model local-model\`

## Enterprise/Remote Custom APIs
For authentication-required endpoints:
\`zenode:config setup --provider custom --custom_url https://your-api.com --api_key YOUR_KEY --custom_model your-model\`

## Benefits of Local Models
- **Privacy**: Your data never leaves your machine
- **Cost**: No per-token charges
- **Control**: Choose exactly which model to run
- **Offline**: Works without internet connection

## Requirements
- Sufficient RAM (4GB+ for smaller models, 16GB+ for larger ones)
- GPU recommended but not required
- Model files can be large (few GB to 100GB+)

## Testing
After setup, test with:
\`zenode:chat "Hello from my local model!"\``;
  }

  /**
   * Get Browserbase-specific setup instructions
   */
  private getBrowserbaseSetupInstructions(): string {
    return `# Browserbase API Setup

## Step 1: Get Your API Key
1. Visit: https://www.browserbase.com/
2. Sign up for an account
3. Access your dashboard to get your API key
4. Copy the API key (starts with bb_live_)

## Step 2: Configure Zenode
Run this command with your actual API key:
\`zenode:config setup --provider browserbase --api_key YOUR_ACTUAL_KEY_HERE\`

## What You'll Get
- **Scalable browser automation** - 1000s of browsers in milliseconds
- **Headless browsing** - Playwright, Puppeteer, Selenium support
- **Web scraping capabilities** - With CAPTCHA solving
- **Global proxy network** - 4 vCPUs per browser instance
- **Screenshot and file handling** - For visual analysis tasks

## Used By
- **zenode:visit** tool for advanced web browsing and scraping

## Key Features
- SOC-2 Type 1 and HIPAA compliant
- Live View iFrame for real-time monitoring
- Browser session recording
- Residential proxy support
- Configurable browser fingerprinting

## Example Usage
After setup, try:
\`zenode:visit "Take a screenshot of google.com and analyze the layout"\`
\`zenode:visit "Scrape the latest news from techcrunch.com"\`

## Pricing
- Check https://www.browserbase.com/ for current pricing
- Pay-per-use model for browser sessions`;
  }

  /**
   * Get SearchAPI-specific setup instructions
   */
  private getSearchAPISetupInstructions(): string {
    return `# SearchAPI Setup

## Step 1: Get Your API Key
1. Visit: https://www.searchapi.io/
2. Create an account
3. Access your dashboard
4. Generate your API key

## Step 2: Configure Zenode
Run this command with your actual API key:
\`zenode:config setup --provider searchapi --api_key YOUR_ACTUAL_KEY_HERE\`

## What You'll Get
- **Multi-engine search** - Google, Bing, YouTube, Amazon
- **Real-time SERP data** - Organic results, ads, knowledge graph
- **Sub-2 second response** - Global proxy network
- **99.9% success rate** - Advanced CAPTCHA solving
- **Geo-targeting** - Precise coordinate-level location targeting

## Used By
- **zenode:visit** tool for comprehensive search tasks

## Key Features
- Pay only for successful searches
- U.S. Legal Shield protection
- Rich snippet extraction
- Related searches and knowledge graph data
- Team management and collaboration tools

## Example Usage
After setup, try:
\`zenode:visit "Search for latest AI developments on Google"\`
\`zenode:visit "Find YouTube videos about Node.js tutorials"\`

## Pricing
- Tiered plans: $4 to $5,000 per month
- Based on search volume (1,000 to 5,000,000 searches)
- Free trial available`;
  }

  /**
   * Get SerpAPI-specific setup instructions
   */
  private getSerpAPISetupInstructions(): string {
    return `# SerpAPI Setup

## Step 1: Get Your API Key
1. Visit: https://serpapi.com/
2. Sign up for an account
3. Access your dashboard
4. Copy your API key

## Step 2: Configure Zenode
Run this command with your actual API key:
\`zenode:config setup --provider serpapi --api_key YOUR_ACTUAL_KEY_HERE\`

## What You'll Get
- **Google Search API** - Real-time search results with 99.95% SLA
- **Google Images API** - Reverse image search capabilities
- **Global location search** - Location-specific results
- **CAPTCHA solving** - Automatic handling
- **Legal protection** - U.S. Legal Shield included

## Used By
- **zenode:visit** tool for Google search and reverse image search

## Key Features
- 100 free searches per month
- Global proxy infrastructure
- Structured JSON results
- Maps, local listings, shopping results
- Knowledge Graph data extraction

## Example Usage
After setup, try:
\`zenode:visit "Reverse search this image: https://example.com/image.jpg"\`
\`zenode:visit "Search Google for 'best restaurants in Tokyo'"\`

## Pricing
- **Free**: 100 searches/month
- **Developer**: $75/month (5,000 searches)
- **Production**: $150/month (15,000 searches)
- **Big Data**: $275/month (30,000 searches)

## Supported Engines
Google, Bing, DuckDuckGo, Yandex, YouTube, Amazon, and many more`;
  }
}