/**
 * Zenode MCP Server - Main server implementation
 *
 * This module implements the core MCP (Model Context Protocol) server that provides
 * AI-powered tools for code analysis, review, and assistance using multiple AI models.
 *
 * The server follows the MCP specification to expose various AI tools as callable functions
 * that can be used by MCP clients (like Claude). Each tool provides specialized functionality
 * such as code review, debugging, deep thinking, and general chat capabilities.
 *
 * Key Components:
 * - MCP Server: Handles protocol communication and tool discovery
 * - Tool Registry: Maps tool names to their implementations
 * - Request Handler: Processes incoming tool calls and returns formatted responses
 * - Configuration: Manages API keys and model settings
 *
 * The server runs on stdio (standard input/output) and communicates using JSON-RPC messages
 * as defined by the MCP protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { VERSION, AUTHOR, UPDATED, hasAnyApiConfigured, getConfiguredProviders, IS_AUTO_MODE } from './config.js';
import { logger, mcpActivityLogger } from './utils/logger.js';
import { modelProviderRegistry } from './providers/registry.js';
import { BaseTool, ToolOutput } from './types/tools.js';
import { reconstructThreadContext } from './utils/conversation-memory.js';

// Tool imports
import { ChatTool } from './tools/chat.js';
import { ThinkDeepTool } from './tools/thinkdeep.js';
import { CodeReviewTool } from './tools/codereview.js';
import { DebugTool } from './tools/debug.js';
import { AnalyzeTool } from './tools/analyze.js';
import { PrecommitTool } from './tools/precommit.js';
import { TestGenTool } from './tools/testgen.js';

// Create the MCP server instance with a unique name identifier
// This name is used by MCP clients to identify and connect to this specific server
const server = new Server(
  {
    name: 'zenode-server',
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Initialize the tool registry with all available AI-powered tools
// Each tool provides specialized functionality for different development tasks
// Tools are instantiated once and reused across requests (stateless design)
const TOOLS: Record<string, BaseTool> = {
  chat: new ChatTool(),
  thinkdeep: new ThinkDeepTool(),
  codereview: new CodeReviewTool(),
  debug: new DebugTool(),
  analyze: new AnalyzeTool(),
  precommit: new PrecommitTool(),
  testgen: new TestGenTool(),
};

/**
 * Configure and validate AI providers based on available API keys.
 *
 * This function checks for API keys and registers the appropriate providers.
 * At least one valid API key (Gemini or OpenAI) is required.
 *
 * @throws {Error} If no valid API keys are found or conflicting configurations detected
 */
async function configureProviders(): Promise<void> {
  // Detailed provider validation matching Python implementation
  const validProviders: string[] = [];
  let hasNativeApis = false;
  let hasOpenRouter = false;
  let hasCustom = false;

  // Check for Gemini API key
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your_gemini_api_key_here') {
    validProviders.push('Gemini');
    hasNativeApis = true;
    logger.info('Gemini API key found - Gemini models available');
  }

  // Check for OpenAI API key
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey && openaiKey !== 'your_openai_api_key_here') {
    validProviders.push('OpenAI (o3)');
    hasNativeApis = true;
    logger.info('OpenAI API key found - o3 model available');
  }

  // Check for OpenRouter API key
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey && openrouterKey !== 'your_openrouter_api_key_here') {
    validProviders.push('OpenRouter');
    hasOpenRouter = true;
    logger.info('OpenRouter API key found - Multiple models available via OpenRouter');
  }

  // Check for custom API endpoint (Ollama, vLLM, etc.)
  const customUrl = process.env.CUSTOM_API_URL;
  if (customUrl) {
    // IMPORTANT: Always read CUSTOM_API_KEY even if empty
    // - Some providers (vLLM, LM Studio, enterprise APIs) require authentication
    // - Others (Ollama) work without authentication (empty key)
    // - DO NOT remove this variable - it's needed for provider factory function
    const customKey = process.env.CUSTOM_API_KEY || ''; // Default to empty (Ollama doesn't need auth)
    const customModel = process.env.CUSTOM_MODEL_NAME || 'llama3.2';
    validProviders.push(`Custom API (${customUrl})`);
    hasCustom = true;
    logger.info(`Custom API endpoint found: ${customUrl} with model ${customModel}`);
    if (customKey) {
      logger.debug('Custom API key provided for authentication');
    } else {
      logger.debug('No custom API key provided (using unauthenticated access)');
    }
  }

  // Require at least one valid provider
  if (validProviders.length === 0) {
    throw new Error(
      'At least one API configuration is required. Please set either:\n' +
        '- GEMINI_API_KEY for Gemini models\n' +
        '- OPENAI_API_KEY for OpenAI o3 model\n' +
        '- OPENROUTER_API_KEY for OpenRouter (multiple models)\n' +
        '- CUSTOM_API_URL for local models (Ollama, vLLM, etc.)',
    );
  }

  logger.info(`Available providers: ${validProviders.join(', ')}`);

  // Log provider priority
  const priority: string[] = [];
  if (hasNativeApis) priority.push('Native APIs (Gemini, OpenAI)');
  if (hasCustom) priority.push('Custom endpoints');
  if (hasOpenRouter) priority.push('OpenRouter (catch-all)');

  if (priority.length > 1) {
    logger.info(`Provider priority: ${priority.join(' → ')}`);
  }

  // Initialize the provider registry
  await modelProviderRegistry.initialize();

  // Check if auto mode has any models available after restrictions
  if (IS_AUTO_MODE) {
    const availableModels = await modelProviderRegistry.getAvailableModels(true);
    if (availableModels.length === 0) {
      logger.error(
        'Auto mode is enabled but no models are available after applying restrictions. ' +
          'Please check your OPENAI_ALLOWED_MODELS and GOOGLE_ALLOWED_MODELS settings.',
      );
      throw new Error(
        'No models available for auto mode due to restrictions. ' +
          'Please adjust your allowed model settings or disable auto mode.',
      );
    }
    logger.info(`Auto mode enabled with ${availableModels.length} available models`);
  }
}

/**
 * List all available tools with their descriptions and input schemas.
 *
 * This handler is called by MCP clients during initialization to discover
 * what tools are available. Each tool provides:
 * - name: Unique identifier for the tool
 * - description: Detailed explanation of what the tool does
 * - inputSchema: JSON Schema defining the expected parameters
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug('MCP client requested tool list');
  const tools: Tool[] = [];

  // Add all registered AI-powered tools from the TOOLS registry
  for (const tool of Object.values(TOOLS)) {
    tools.push({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.getInputSchema(),
    });
  }

  // Add utility tools that provide server metadata and configuration info
  // These tools don't require AI processing but are useful for clients
  tools.push({
    name: 'version',
    description:
      'VERSION & CONFIGURATION - Get server version, configuration details, ' +
      'and list of available tools. Useful for debugging and understanding capabilities.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  });

  logger.debug(`Returning ${tools.length} tools to MCP client`);
  return { tools };
});

/**
 * Handle incoming tool execution requests from MCP clients.
 *
 * This is the main request dispatcher that routes tool calls to their
 * appropriate handlers. It supports both AI-powered tools (from TOOLS registry)
 * and utility tools (implemented as static functions).
 *
 * Thread Context Reconstruction:
 * If the request contains a continuation_id, this function reconstructs
 * the conversation history and injects it into the tool's context.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info(`MCP tool call: ${name}`);
  logger.debug(`MCP tool arguments: ${Object.keys(args || {}).join(', ')}`);

  // Log to activity file for monitoring
  mcpActivityLogger.info(`TOOL_CALL: ${name} with ${Object.keys(args || {}).length} arguments`);

  try {
    // Handle thread context reconstruction if continuation_id is present
    let processedArgs = args || {};
    if (processedArgs.continuation_id) {
      const continuationId = processedArgs.continuation_id as string;
      logger.debug(`Resuming conversation thread: ${continuationId}`);
      mcpActivityLogger.info(`CONVERSATION_RESUME: ${name} resuming thread ${continuationId}`);
      
      processedArgs = await reconstructThreadContext(processedArgs);
    }

    // Route to AI-powered tools that require AI API calls
    if (name in TOOLS) {
      logger.info(`Executing tool '${name}' with ${Object.keys(processedArgs).length} parameter(s)`);
      const tool = TOOLS[name];
      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
      }
      const result = await tool.execute(processedArgs);
      logger.info(`Tool '${name}' execution completed`);
      
      return formatToolResponse(result);
    }

    // Handle version tool
    if (name === 'version') {
      return formatVersionResponse();
    }

    // Unknown tool
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  } catch (error) {
    logger.error(`Tool execution error for '${name}':`, error);
    
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : 'An unexpected error occurred',
    );
  }
});

/**
 * Format tool output for MCP response
 */
function formatToolResponse(output: ToolOutput): { content: TextContent[] } {
  const content: TextContent[] = [
    {
      type: 'text',
      text: output.content,
    },
  ];

  // Add continuation offer if present
  if (output.continuation_offer) {
    const offer = output.continuation_offer;
    content.push({
      type: 'text',
      text: `\n\n**Conversation can be continued** (thread: ${offer.thread_id})\n` +
        `Stats: ${offer.stats.total_turns} turns, ` +
        `${offer.stats.total_input_tokens + offer.stats.total_output_tokens} total tokens\n` +
        `Suggestions:\n${offer.suggestions.map((s) => `- ${s}`).join('\n')}`,
    });
  }

  return { content };
}

/**
 * Format version response
 */
function formatVersionResponse(): { content: TextContent[] } {
  const startTime = new Date().toISOString();
  const providers = getConfiguredProviders();
  const toolNames = Object.keys(TOOLS).concat(['version']);

  const versionInfo = `Zenode MCP Server v${VERSION}
Updated: ${UPDATED}
Author: ${AUTHOR}

Configuration:
- Default Model: ${process.env.DEFAULT_MODEL || 'auto'}
- Default Thinking Mode (ThinkDeep): ${process.env.DEFAULT_THINKING_MODE_THINKDEEP || 'high'}
- Max Context: Dynamic (model-specific)
- Node.js: ${process.version}
- Started: ${startTime}

Configured Providers:
${providers.map((p) => `  - ${p}`).join('\n')}

Available Tools:
${toolNames.map((t) => `  - ${t}`).join('\n')}

For updates, visit: https://github.com/yourusername/zenode-mcp-server`;

  return {
    content: [
      {
        type: 'text',
        text: versionInfo,
      },
    ],
  };
}

/**
 * Main server initialization
 */
async function main() {
  logger.info('Starting Zenode MCP Server...');
  logger.info(`Version: ${VERSION}`);
  logger.info(`Node.js: ${process.version}`);

  try {
    // Validate API configuration
    if (!hasAnyApiConfigured()) {
      throw new Error(
        'No API keys configured. Please set at least one of: ' +
          'GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or CUSTOM_API_URL',
      );
    }

    // Configure providers
    await configureProviders();

    // Start the stdio server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    logger.info('Zenode MCP Server started successfully');
    logger.info('Listening for MCP requests on stdio...');
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});