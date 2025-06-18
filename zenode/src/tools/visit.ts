/**
 * Visit Tool - Web browsing, search, and reverse image search with optional APIs
 * 
 * This tool provides comprehensive web browsing and search capabilities using:
 * - Browserbase for browser automation (optional)
 * - SearchAPI for multi-engine search (optional) 
 * - SerpAPI for Google search and reverse image search (optional)
 * 
 * The tool gracefully handles missing API keys and provides helpful setup guidance.
 */

import { z } from 'zod';
import { BaseTool } from './base.js';
import { ToolOutput, VisitRequest } from '../types/tools.js';
import { BaseToolRequestSchema } from '../utils/schema-helpers.js';
import { TEMPERATURE_BALANCED, BROWSERBASE_API_KEY, SEARCHAPI_KEY, SERPAPI_KEY } from '../config.js';
import { logger } from '../utils/logger.js';
import https from 'https';
import http from 'http';

/**
 * Visit tool request schema
 */
const VisitRequestSchema = BaseToolRequestSchema.extend({
  action: z.enum(['browse', 'search', 'reverse_image_search', 'screenshot']).optional().describe('Specific action to perform (defaults to auto-detect based on prompt)'),
  url: z.string().optional().describe('URL to visit or image URL for reverse search'),
  query: z.string().optional().describe('Search query'),
  engine: z.enum(['google', 'bing', 'youtube', 'auto']).optional().describe('Search engine to use (defaults to auto)'),
  location: z.string().optional().describe('Geographic location for search results (e.g., "United States", "Tokyo, Japan")'),
  take_screenshot: z.boolean().optional().describe('Whether to take a screenshot of the visited page'),
});

/**
 * Visit tool implementation
 */
export class VisitTool extends BaseTool {
  name = 'visit';
  description = 
    'WEB BROWSING & SEARCH - Comprehensive web browsing, search, and reverse image search capabilities. ' +
    'IMPORTANT: This tool MUST be used when explicitly invoked (e.g., "zenode:visit [query/url]"). ' +
    'Supports browser automation via Browserbase, multi-engine search via SearchAPI, and Google search/reverse image search via SerpAPI. ' +
    'All APIs are optional - the tool will guide you through setup when needed and gracefully degrade when APIs are unavailable. ' +
    'Perfect for: web research, reverse image search, content analysis, competitive analysis, and automated browsing tasks.';
  
  defaultTemperature = TEMPERATURE_BALANCED;
  modelCategory = 'fast' as const;

  getZodSchema() {
    return VisitRequestSchema;
  }

  getSystemPrompt(): string {
    const apiStatus = this.getApiStatus();
    
    return `You are a web browsing and search specialist with access to multiple optional APIs for enhanced capabilities.

## Available APIs & Capabilities

### SerpAPI (Google Search & Reverse Image Search)
${apiStatus.serpapi.configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}
- **Google Search API**: Real-time search results with 99.95% SLA guarantee
- **Google Images Reverse Search**: Find where images are used across the web
- **Location-based search**: Get region-specific results
- **CAPTCHA solving**: Automatic handling of search challenges
- **Legal protection**: U.S. Legal Shield for data collection
- **Rate limits**: 100 free searches/month, paid plans available
- **Endpoint**: https://serpapi.com/search.json
- **Key features**: Structured JSON results, Knowledge Graph data, shopping results

### SearchAPI (Multi-Engine Search)
${apiStatus.searchapi.configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}
- **Multi-engine support**: Google, Bing, YouTube, Amazon, and more
- **Real-time SERP data**: Organic results, ads, knowledge graph entries
- **Sub-2 second response**: Global proxy network infrastructure
- **99.9% success rate**: Advanced CAPTCHA solving
- **Geo-targeting**: Precise coordinate-level location targeting
- **Endpoint**: https://www.searchapi.io/api/v1/search
- **Key features**: Pay per successful search, rich snippet extraction

### Browserbase (Browser Automation)
${apiStatus.browserbase.configured ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}
- **Scalable browsers**: Spin up 1000s of browsers in milliseconds
- **Full automation**: Playwright, Puppeteer, Selenium support
- **Global infrastructure**: 4 vCPUs per browser, globally distributed
- **Security compliant**: SOC-2 Type 1 and HIPAA compliant
- **Advanced features**: Live view, session recording, proxy support
- **Endpoint**: https://www.browserbase.com/v1/sessions
- **Key features**: Screenshot capture, file upload/download, fingerprinting

## Your Role & Guidelines

You are responsible for:
1. **Intelligent API selection**: Choose the best API for each task based on requirements and availability
2. **Graceful degradation**: Provide helpful alternatives when preferred APIs are unavailable
3. **Setup guidance**: Guide users through API configuration when needed
4. **Result synthesis**: Combine results from multiple sources when beneficial
5. **Error handling**: Provide clear explanations when requests fail

### API Selection Strategy:
- **Reverse image search**: Prefer SerpAPI (Google Images), fallback to SearchAPI
- **General web search**: Use SearchAPI for multi-engine, SerpAPI for Google-specific
- **Browser automation**: Use Browserbase for screenshots, scraping, complex interactions
- **Location-specific search**: Prefer SerpAPI for precise geo-targeting

### When APIs are unavailable:
- Explain what the API would provide
- Suggest manual alternatives or free tools
- Offer to help with API setup using zenode:config tool

### Response format:
- Always explain which APIs you're using and why
- Provide setup instructions for missing APIs when relevant
- Include rate limit and cost considerations
- Structure results clearly with source attribution

Remember: All APIs are optional enhancements. Always provide value even when working with limited capabilities.`;
  }

  async execute(args: VisitRequest): Promise<ToolOutput> {
    try {
      const validated = this.validateArgs<VisitRequest>(args);
      logger.info(`Visit tool invoked with prompt: ${validated.prompt?.substring(0, 100)}...`);
      
      // Analyze the request to determine the best approach
      const intent = this.analyzeIntent(validated);
      const apiStatus = this.getApiStatus();
      
      // Check API availability and provide setup guidance if needed
      const requiredApis = this.getRequiredApis(intent);
      const missingApis = requiredApis.filter(api => {
        const status = apiStatus[api as keyof typeof apiStatus];
        return status ? !status.configured : true;
      });
      
      if (missingApis.length > 0) {
        return await this.handleMissingApis(intent, missingApis, apiStatus);
      }
      
      // Execute the appropriate action based on intent
      switch (intent.action) {
        case 'reverse_image_search':
          return await this.handleReverseImageSearch(validated, intent);
        case 'search':
          return await this.handleSearch(validated, intent);
        case 'browse':
          return await this.handleBrowse(validated, intent);
        case 'screenshot':
          return await this.handleScreenshot(validated, intent);
        default:
          return this.formatOutput(
            `I couldn't determine the best approach for your request: "${validated.prompt}"\n\n` +
            'Please try being more specific:\n' +
            '- "Search for [query]" for web search\n' +
            '- "Reverse search this image: [url]" for image search\n' +
            '- "Browse [url]" or "Screenshot [url]" for web browsing',
            'error'
          );
      }
      
    } catch (error) {
      logger.error('Visit tool error:', error);
      
      if (error instanceof z.ZodError) {
        return this.formatOutput(
          `Invalid request: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          'error'
        );
      }
      
      return this.formatOutput(
        `Visit operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'error'
      );
    }
  }

  /**
   * Analyze user intent to determine the best action
   */
  private analyzeIntent(args: VisitRequest): { action: string; confidence: number; reasoning: string } {
    const prompt = args.prompt?.toLowerCase() || '';
    const hasUrl = args.url || prompt.includes('http');
    const hasImageUrl = hasUrl && (prompt.includes('.jpg') || prompt.includes('.png') || prompt.includes('.gif') || prompt.includes('.webp'));
    
    // Explicit action provided
    if (args.action) {
      return { action: args.action, confidence: 1.0, reasoning: 'Explicit action specified' };
    }
    
    // Reverse image search patterns
    if (prompt.includes('reverse') && (prompt.includes('image') || prompt.includes('photo'))) {
      return { action: 'reverse_image_search', confidence: 0.9, reasoning: 'Contains "reverse" + "image/photo"' };
    }
    
    if (hasImageUrl && (prompt.includes('search') || prompt.includes('find'))) {
      return { action: 'reverse_image_search', confidence: 0.8, reasoning: 'Image URL + search terms' };
    }
    
    // Screenshot patterns
    if (prompt.includes('screenshot') || prompt.includes('capture')) {
      return { action: 'screenshot', confidence: 0.9, reasoning: 'Contains screenshot/capture terms' };
    }
    
    // Browse patterns
    if (hasUrl && !hasImageUrl) {
      if (prompt.includes('browse') || prompt.includes('visit') || prompt.includes('scrape')) {
        return { action: 'browse', confidence: 0.8, reasoning: 'URL + browse/visit/scrape terms' };
      }
      return { action: 'browse', confidence: 0.6, reasoning: 'URL provided without search terms' };
    }
    
    // Search patterns
    if (prompt.includes('search') || prompt.includes('find') || args.query) {
      return { action: 'search', confidence: 0.8, reasoning: 'Contains search terms or query provided' };
    }
    
    // Default to search for general queries
    return { action: 'search', confidence: 0.5, reasoning: 'Default to search for general queries' };
  }

  /**
   * Determine which APIs are required for a given intent
   */
  private getRequiredApis(intent: { action: string }): string[] {
    switch (intent.action) {
      case 'reverse_image_search':
        return ['serpapi']; // Prefer SerpAPI for reverse image search
      case 'search':
        return ['searchapi', 'serpapi']; // Either API can handle search
      case 'browse':
      case 'screenshot':
        return ['browserbase']; // Requires browser automation
      default:
        return [];
    }
  }

  /**
   * Get current API configuration status
   */
  private getApiStatus() {
    return {
      browserbase: {
        configured: !!(BROWSERBASE_API_KEY && BROWSERBASE_API_KEY !== 'your_browserbase_api_key_here'),
        key: BROWSERBASE_API_KEY
      },
      searchapi: {
        configured: !!(SEARCHAPI_KEY && SEARCHAPI_KEY !== 'your_searchapi_key_here'),
        key: SEARCHAPI_KEY
      },
      serpapi: {
        configured: !!(SERPAPI_KEY && SERPAPI_KEY !== 'your_serpapi_key_here'),
        key: SERPAPI_KEY
      }
    };
  }

  /**
   * Handle missing API keys by providing setup guidance
   */
  private async handleMissingApis(intent: any, missingApis: string[], apiStatus: any): Promise<ToolOutput> {
    const action = intent.action;
    const setupInstructions: string[] = [];
    
    setupInstructions.push(`# ${this.getActionTitle(action)} - API Setup Required\n`);
    setupInstructions.push(`I'd like to help you with **${action.replace('_', ' ')}**, but I need additional API access.\n`);
    
    for (const api of missingApis) {
      setupInstructions.push(this.getApiSetupInstructions(api));
    }
    
    setupInstructions.push('\n## Alternative Options');
    setupInstructions.push(this.getAlternativeOptions(action));
    
    setupInstructions.push('\n## Quick Setup');
    setupInstructions.push('Once you have an API key, configure it with:');
    for (const api of missingApis) {
      setupInstructions.push(`\`zenode:config setup --provider ${api} --api_key YOUR_KEY\``);
    }
    
    return this.formatOutput(setupInstructions.join('\n'), 'success');
  }

  /**
   * Get action title for display
   */
  private getActionTitle(action: string): string {
    const titles: Record<string, string> = {
      reverse_image_search: 'Reverse Image Search',
      search: 'Web Search',
      browse: 'Web Browsing',
      screenshot: 'Website Screenshot'
    };
    return titles[action] || action;
  }

  /**
   * Get API-specific setup instructions
   */
  private getApiSetupInstructions(api: string): string {
    switch (api) {
      case 'serpapi':
        return `
### SerpAPI (Recommended for reverse image search)
- **Purpose**: Google Search + Google Images reverse search
- **Signup**: https://serpapi.com/ 
- **Free tier**: 100 searches/month
- **Best for**: Reverse image search, Google-specific results
- **Setup**: \`zenode:config setup --provider serpapi\``;

      case 'searchapi':
        return `
### SearchAPI (Multi-engine search)
- **Purpose**: Google, Bing, YouTube, Amazon search
- **Signup**: https://www.searchapi.io/
- **Free tier**: Available
- **Best for**: Multi-engine search, alternative to Google
- **Setup**: \`zenode:config setup --provider searchapi\``;

      case 'browserbase':
        return `
### Browserbase (Browser automation)
- **Purpose**: Headless browsing, screenshots, web scraping
- **Signup**: https://www.browserbase.com/
- **Features**: Scalable browsers, CAPTCHA solving, global proxies
- **Best for**: Screenshots, complex web interactions, scraping
- **Setup**: \`zenode:config setup --provider browserbase\``;

      default:
        return `### ${api}: Configuration needed`;
    }
  }

  /**
   * Get alternative options when APIs are unavailable
   */
  private getAlternativeOptions(action: string): string {
    switch (action) {
      case 'reverse_image_search':
        return `
- **Manual option**: Visit https://images.google.com and use the camera icon
- **Browser extension**: Use reverse image search browser extensions
- **Alternative sites**: TinEye.com, Bing Visual Search, Yandex Images`;

      case 'search':
        return `
- **Direct search**: Use your browser to search on Google, Bing, etc.
- **Research tools**: Use academic search engines like Google Scholar
- **Social search**: Search on Twitter, Reddit, Stack Overflow directly`;

      case 'browse':
      case 'screenshot':
        return `
- **Manual browsing**: Open the website in your browser
- **Browser tools**: Use browser developer tools for analysis
- **Online tools**: Use online screenshot services like web.archive.org`;

      default:
        return '- Manual alternatives available through web browser';
    }
  }

  /**
   * Handle reverse image search requests
   */
  private async handleReverseImageSearch(args: VisitRequest, intent: any): Promise<ToolOutput> {
    const imageUrl = args.url || this.extractImageUrl(args.prompt || '');
    
    if (!imageUrl) {
      return this.formatOutput(
        'I need an image URL to perform reverse image search.\n\n' +
        'Please provide:\n' +
        '- Direct image URL (e.g., https://example.com/image.jpg)\n' +
        '- Or specify with --url parameter\n\n' +
        'Example: `zenode:visit "Reverse search this image: https://example.com/image.jpg"`',
        'error'
      );
    }

    try {
      // Use SerpAPI for reverse image search
      const results = await this.performSerpApiReverseImageSearch(imageUrl);
      return this.formatOutput(results, 'success');
    } catch (error) {
      return this.formatOutput(
        `Reverse image search failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
        'You can try manual reverse image search at:\n' +
        '- https://images.google.com (click camera icon)\n' +
        '- https://tineye.com\n' +
        '- https://yandex.com/images',
        'error'
      );
    }
  }

  /**
   * Extract image URL from prompt text
   */
  private extractImageUrl(prompt: string): string | null {
    const urlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|bmp)/i;
    const match = prompt.match(urlRegex);
    return match ? match[0] : null;
  }

  /**
   * Perform reverse image search using SerpAPI
   */
  private async performSerpApiReverseImageSearch(imageUrl: string): Promise<string> {
    const apiKey = SERPAPI_KEY;
    if (!apiKey) {
      throw new Error('SerpAPI key not configured');
    }

    const params = new URLSearchParams({
      engine: 'google_reverse_image',
      image_url: imageUrl,
      api_key: apiKey
    });

    const apiUrl = `https://serpapi.com/search.json?${params.toString()}`;
    
    return new Promise((resolve, reject) => {
      https.get(apiUrl, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            
            if (result.error) {
              reject(new Error(`SerpAPI Error: ${result.error}`));
              return;
            }
            
            resolve(this.formatReverseImageResults(result, imageUrl));
          } catch (error) {
            reject(new Error('Failed to parse SerpAPI response'));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Format reverse image search results
   */
  private formatReverseImageResults(apiResult: any, imageUrl: string): string {
    let output = `# Reverse Image Search Results\n\n`;
    output += `**Image analyzed**: ${imageUrl}\n\n`;

    // Visual matches
    if (apiResult.image_results && apiResult.image_results.length > 0) {
      output += `## 🖼️ Visual Matches (${apiResult.image_results.length})\n\n`;
      
      apiResult.image_results.slice(0, 10).forEach((result: any, index: number) => {
        output += `### ${index + 1}. ${result.title || 'Untitled'}\n`;
        output += `- **Source**: ${result.source || 'Unknown'}\n`;
        if (result.link) output += `- **URL**: ${result.link}\n`;
        if (result.thumbnail) output += `- **Preview**: ${result.thumbnail}\n`;
        output += '\n';
      });
    }

    // Pages containing the image
    if (apiResult.inline_images && apiResult.inline_images.length > 0) {
      output += `## 📄 Pages Containing This Image (${apiResult.inline_images.length})\n\n`;
      
      apiResult.inline_images.slice(0, 5).forEach((page: any, index: number) => {
        output += `### ${index + 1}. ${page.title || 'Untitled Page'}\n`;
        if (page.link) output += `- **URL**: ${page.link}\n`;
        if (page.snippet) output += `- **Context**: ${page.snippet}\n`;
        output += '\n';
      });
    }

    // Related searches
    if (apiResult.related_searches && apiResult.related_searches.length > 0) {
      output += `## 🔍 Related Searches\n\n`;
      apiResult.related_searches.slice(0, 5).forEach((search: any) => {
        if (search.query) {
          output += `- ${search.query}\n`;
        }
      });
      output += '\n';
    }

    // Search information
    if (apiResult.search_information) {
      output += `## ℹ️ Search Statistics\n\n`;
      if (apiResult.search_information.total_results) {
        output += `- **Total results**: ${apiResult.search_information.total_results}\n`;
      }
      if (apiResult.search_information.time_taken_displayed) {
        output += `- **Search time**: ${apiResult.search_information.time_taken_displayed}\n`;
      }
    }

    if (!apiResult.image_results && !apiResult.inline_images) {
      output += '❌ **No matches found** for this image.\n\n';
      output += 'This could mean:\n';
      output += '- The image is original/unique\n';
      output += '- The image is new and not yet indexed\n';
      output += '- The image has been modified from its original\n';
    }

    output += '\n---\n*Results powered by SerpAPI Google Reverse Image Search*';
    
    return output;
  }

  /**
   * Handle general search requests
   */
  private async handleSearch(args: VisitRequest, intent: any): Promise<ToolOutput> {
    // Implementation for general search
    return this.formatOutput(
      'General search functionality will be implemented next.\n\n' +
      'For now, you can:\n' +
      '- Set up SerpAPI: `zenode:config setup --provider serpapi`\n' +
      '- Set up SearchAPI: `zenode:config setup --provider searchapi`',
      'success'
    );
  }

  /**
   * Handle browse requests
   */
  private async handleBrowse(args: VisitRequest, intent: any): Promise<ToolOutput> {
    // Implementation for browsing
    return this.formatOutput(
      'Web browsing functionality will be implemented next.\n\n' +
      'For now, you can:\n' +
      '- Set up Browserbase: `zenode:config setup --provider browserbase`',
      'success'
    );
  }

  /**
   * Handle screenshot requests
   */
  private async handleScreenshot(args: VisitRequest, intent: any): Promise<ToolOutput> {
    // Implementation for screenshots
    return this.formatOutput(
      'Screenshot functionality will be implemented next.\n\n' +
      'For now, you can:\n' +
      '- Set up Browserbase: `zenode:config setup --provider browserbase`',
      'success'
    );
  }
}