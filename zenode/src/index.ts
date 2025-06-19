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
import winston from 'winston';
import { modelProviderRegistry } from './providers/registry.js';
import { BaseTool, ToolOutput } from './types/tools.js';
import { reconstructThreadContext } from './utils/conversation-memory.js';
// import { DefaultMiddlewarePipeline, ToolContext } from './middleware/index.js';
import { configLoader } from './config/loader.js';

// Tool imports
import { ChatTool } from './tools/chat.js';
import { ThinkDeepTool } from './tools/thinkdeep.js';
import { CodeReviewTool } from './tools/codereview.js';
import { ConsensusTool } from './tools/consensus.js';
import { DebugTool } from './tools/debug.js';
import { AnalyzeTool } from './tools/analyze.js';
import { PrecommitTool } from './tools/precommit.js';
import { TestGenTool } from './tools/testgen.js';
import { GopherTool } from './tools/gopher.js';
import { GruntsTool } from './tools/grunts.js';
import { ConfigTool } from './tools/config.js';
import { BootstrapTool } from './tools/bootstrap.js';
import { PlannerTool } from './tools/planner.js';
import { SeerTool } from './tools/seer.js';
import { VisitTool } from './tools/visit.js';

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

// Initialize the tool registry with all available tools
// Each tool provides specialized functionality for different development tasks
// Tools are instantiated once and reused across requests (stateless design)
const TOOLS: Record<string, BaseTool> = {
  chat: new ChatTool(),
  thinkdeep: new ThinkDeepTool(),
  codereview: new CodeReviewTool(),
  consensus: new ConsensusTool(), // Multi-model perspective gathering with stance assignment
  debug: new DebugTool(),
  analyze: new AnalyzeTool(),
  precommit: new PrecommitTool(),
  testgen: new TestGenTool(),
  gopher: new GopherTool(), // Local file system access bridge
  grunts: new GruntsTool(), // Distributed LLM orchestration system
  config: new ConfigTool(), // Interactive CLI configuration tool
  bootstrap: new BootstrapTool(), // First-time setup and project configuration
  planner: new PlannerTool(), // Interactive step-by-step planning tool
  seer: new SeerTool(), // Dedicated vision and image analysis tool
  visit: new VisitTool(), // Web browsing, search, and reverse image search
};

// NOTE: Middleware pipeline completely disabled due to console output conflicts
// It was causing doubling of output when viewing /mcp tools
// TODO: Fix console.log statements in middleware before re-enabling
// const middlewarePipeline = new DefaultMiddlewarePipeline();
// const conversationLogger = new ConversationLoggerMiddleware();
// middlewarePipeline.register(conversationLogger);

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
 * 
 * Middleware Integration:
 * All tool calls are processed through the middleware pipeline for logging,
 * monitoring, and other cross-cutting concerns.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info(`MCP tool call: ${name}`);
  logger.debug(`MCP tool arguments: ${Object.keys(args || {}).join(', ')}`);

  // Log to activity file for monitoring
  mcpActivityLogger.info(`TOOL_CALL: ${name} with ${Object.keys(args || {}).length} arguments`);

  // Check for :z coordination shorthand
  const shortcuts = configLoader.getShortcutsConfig();
  const isCoordinationRequest = args?.prompt && 
    typeof args.prompt === 'string' && 
    args.prompt.startsWith(shortcuts.coordinationPrefix);

  if (isCoordinationRequest && name !== 'chat') {
    // Redirect :z requests to chat tool for coordination
    logger.info(`Redirecting :z coordination request to chat tool`);
    return await executeCoordinatedRequest(args);
  }

  // NOTE: Middleware pipeline disabled to prevent console output doubling
  // const context: ToolContext = {
  //   toolName: name,
  //   requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
  //   timestamp: new Date(),
  //   input: args,
  //   conversationId: args?.continuation_id as string | undefined,
  // };
  // await middlewarePipeline.executeRequest(context);

  try {
    // Handle thread context reconstruction if continuation_id is present
    let processedArgs = args || {};
    if (processedArgs.continuation_id) {
      const continuationId = processedArgs.continuation_id as string;
      logger.debug(`Resuming conversation thread: ${continuationId}`);
      mcpActivityLogger.info(`CONVERSATION_RESUME: ${name} resuming thread ${continuationId}`);
      
      processedArgs = await reconstructThreadContext(processedArgs);
    }

    let result: any;

    // Route to AI-powered tools that require AI API calls
    if (name in TOOLS) {
      logger.info(`Executing tool '${name}' with ${Object.keys(processedArgs).length} parameter(s)`);
      const tool = TOOLS[name];
      if (!tool) {
        throw new McpError(ErrorCode.MethodNotFound, `Tool ${name} not found`);
      }
      result = await tool.execute(processedArgs);
      logger.info(`Tool '${name}' execution completed`);
    }
    // Handle version tool
    else if (name === 'version') {
      result = formatVersionResponse();
    }
    // Unknown tool
    else {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    // NOTE: Response middleware disabled to prevent console output doubling
    // await middlewarePipeline.executeResponse(context, result);
    
    return name === 'version' ? result : formatToolResponse(result);
  } catch (error) {
    logger.error(`Tool execution error for '${name}':`, error);
    
    // NOTE: Error middleware disabled to prevent console output doubling
    // await middlewarePipeline.executeResponse(context, null, error as Error);
    
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
 * Detect if specific tool names are mentioned in the prompt
 */
function detectMentionedTools(prompt: string): string[] {
  const availableTools = Object.keys(TOOLS);
  const mentionedTools: string[] = [];
  
  const lowerPrompt = prompt.toLowerCase();
  for (const tool of availableTools) {
    if (lowerPrompt.includes(tool.toLowerCase())) {
      mentionedTools.push(tool);
    }
  }
  
  return mentionedTools;
}

/**
 * Execute coordinated request using multiple tools
 */
async function executeCoordinatedRequest(args: any): Promise<{ content: TextContent[] }> {
  const shortcuts = configLoader.getShortcutsConfig();
  const originalPrompt = args.prompt as string;
  
  // Remove the :z prefix from the prompt
  const cleanPrompt = originalPrompt.substring(shortcuts.coordinationPrefix.length).trim();
  
  // Detect if specific tools are mentioned
  const mentionedTools = detectMentionedTools(cleanPrompt);
  const hasSpecificTools = mentionedTools.length > 0;
  
  logger.info(`Executing :z coordination for: "${cleanPrompt}"`);
  logger.info(`Mentioned tools: ${mentionedTools.join(', ') || 'none'}`);
  
  // Determine coordination strategy
  let toolsToUse: string[];
  if (hasSpecificTools) {
    // Use mentioned tools plus chat for coordination
    toolsToUse = ['chat', ...mentionedTools].filter((tool, index, arr) => arr.indexOf(tool) === index);
    mcpActivityLogger.info(`COORDINATION_START: specific tools - ${toolsToUse.join(', ')}`);
  } else {
    // No specific tools mentioned - prioritize thinkdeep and analyze
    toolsToUse = ['chat', 'thinkdeep', 'analyze'];
    mcpActivityLogger.info(`COORDINATION_START: default enhanced - ${toolsToUse.join(', ')}`);
  }
  
  const results: string[] = [];
  const toolsUsed: string[] = [];
  let conversationId: string | undefined = args.continuation_id;
  
  try {
    // Execute tools in sequence
    for (const toolName of toolsToUse) {
      if (TOOLS[toolName]) {
        logger.info(`Executing ${toolName} tool`);
        
        let toolPrompt = cleanPrompt;
        
        // For thinkdeep and analyze when no specific tools mentioned, add question generation instruction
        if (!hasSpecificTools && (toolName === 'thinkdeep' || toolName === 'analyze')) {
          toolPrompt += `\n\nAdditionally, please generate at least 2 probing questions based on your analysis to help explore this topic deeper.`;
        }
        
        const toolArgs = { 
          ...args, 
          prompt: toolPrompt,
          continuation_id: conversationId 
        };
        
        const tool = TOOLS[toolName];
        const result = await tool.execute(toolArgs);
        
        // Map tool names to emojis
        const emoji = toolName === 'chat' ? '💬' :
                      toolName === 'analyze' ? '🔍' : 
                      toolName === 'thinkdeep' ? '🧠' : 
                      toolName === 'debug' ? '🐛' : 
                      toolName === 'codereview' ? '👀' :
                      toolName === 'precommit' ? '🔒' :
                      toolName === 'testgen' ? '🧪' : '🔧';
        
        results.push(`## ${emoji} **${toolName.toUpperCase()}**\n${result.content}`);
        toolsUsed.push(toolName);
        
        // Update conversation ID for next tool
        if (result.continuation_offer?.thread_id) {
          conversationId = result.continuation_offer.thread_id;
        }
      }
    }
    
    mcpActivityLogger.info(`COORDINATION_COMPLETE: ${toolsUsed.length} tools executed`);
    
    // Combine all results
    const strategy = hasSpecificTools ? 'specific tools detected' : 'enhanced default (thinkdeep + analyze focus)';
    const combinedContent = `# 🤖 **Zenode Coordination Results**\n\n` +
      `*Strategy: ${strategy} | Tools used: ${toolsUsed.join(', ')}*\n\n` +
      results.join('\n\n---\n\n') + 
      (conversationId ? `\n\n**Thread ID:** ${conversationId}` : '');
    
    return {
      content: [{
        type: 'text',
        text: combinedContent
      }]
    };
    
  } catch (error) {
    logger.error('Coordination error:', error);
    mcpActivityLogger.info(`COORDINATION_ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    return {
      content: [{
        type: 'text',
        text: `❌ **Coordination Error**\n\nFailed to execute coordinated request: ${error instanceof Error ? error.message : 'Unknown error'}\n\nTools attempted: ${toolsUsed.join(', ')}`
      }]
    };
  }
}

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
    // Load configuration first
    const config = await configLoader.loadConfig();
    const validation = configLoader.validateConfig(config);
    
    if (!validation.valid) {
      logger.error('Configuration validation failed:', validation.errors);
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }
    
    logger.info(`Configuration loaded - Trigger pattern: "${config.logging.conversationTrigger}"`);
    logger.info(`Logging enabled: ${config.logging.enabled}, Path: ${config.logging.logPath}`);
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

/**
 * CLI Mode Handler
 * 
 * Enables zenode to run as both MCP server and CLI tool
 * Usage: node dist/index.js [toolname] [json_args]
 * Example: node dist/index.js seer '{"prompt":"analyze image","images":["/path/to/image.jpg"]}'
 */
async function runCliMode() {
  const toolName = process.argv[2];
  const argsJson = process.argv[3] || '{}';
  
  if (!toolName) {
    console.log(`❌ Tool name required. Usage: node dist/index.js <toolname> [json_args]`);
    console.log(`Available tools: ${Object.keys(TOOLS).concat(['version']).join(', ')}`);
    process.exit(1);
  }
  
  // Suppress winston logging in CLI mode unless debug is enabled
  if (!process.env.ZENODE_CLI_DEBUG) {
    logger.transports.forEach(transport => {
      if (transport instanceof winston.transports.Console) {
        transport.silent = true;
      }
    });
  }
  
  console.log(`🔧 Zenode CLI Mode - Running tool: ${toolName}`);
  
  try {
    const args = JSON.parse(argsJson);
    
    // Validate API configuration
    if (!hasAnyApiConfigured()) {
      throw new Error(
        'No API keys configured. Please set at least one of: ' +
          'GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or CUSTOM_API_URL',
      );
    }

    // Configure providers
    await configureProviders();
    
    let result: any;
    
    // Route to AI-powered tools
    if (toolName in TOOLS) {
      console.log(`⚡ Executing ${toolName} tool...`);
      const tool = TOOLS[toolName as keyof typeof TOOLS];
      if (!tool) {
        throw new Error(`Tool ${toolName} not found in registry`);
      }
      result = await tool.execute(args);
      console.log(`✅ ${toolName} completed successfully`);
    }
    // Handle version tool
    else if (toolName === 'version') {
      result = formatVersionResponse();
    }
    // Unknown tool
    else {
      throw new Error(`Unknown tool: ${toolName}. Available tools: ${Object.keys(TOOLS).concat(['version']).join(', ')}`);
    }
    
    // Output result as JSON for programmatic use, or formatted for human reading
    if (process.env.ZENODE_CLI_OUTPUT === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (toolName === 'version') {
        console.log(result.content?.[0]?.text || 'Version info unavailable');
      } else {
        console.log('\n📋 Result:');
        console.log(result.content || 'No content');
        if (result.continuation_offer) {
          const offer = result.continuation_offer;
          console.log(`\n🔗 Thread: ${offer.thread_id} | Turns: ${offer.stats.total_turns} | Tokens: ${offer.stats.total_input_tokens + offer.stats.total_output_tokens}`);
        }
      }
    }
    
    // Exit successfully in CLI mode
    process.exit(0);
    
  } catch (error) {
    console.error(`❌ CLI Error:`, error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Main entry point - detects MCP vs CLI mode
 */

async function startZenode() {
  // Check if CLI arguments are provided
  const hasCliArgs = process.argv.length > 2;
  
  if (hasCliArgs) {
    // CLI Mode: node dist/index.js toolname args
    await runCliMode();
  } else {
    // MCP Server Mode: Default behavior for MCP clients
    await main();
  }
}

// Start zenode in appropriate mode
startZenode().catch((error) => {
  logger.error('Unhandled error:', error);
  process.exit(1);
});