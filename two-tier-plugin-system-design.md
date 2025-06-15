# Two-Tier Plugin System Design for Zenode MCP Server

## Overview

We're designing a plugin system that supports two types of plugins:

1. **Tool Plugins** - New MCP tools that extend functionality (like current tools)
2. **Middleware Plugins** - Request/response interceptors that modify behavior

This leverages both MCP Tools for execution and MCP Resources for plugin discovery and configuration.

## Plugin Architecture

### 1. Tool Plugins (Execution Layer)

Tool plugins are standard MCP tools that follow our new Zod-based interface:

```typescript
// Tool Plugin Interface
interface ToolPlugin extends BaseTool {
  name: string;
  version: string;
  description: string;
  getZodSchema(): z.ZodSchema;
  execute(args: any): Promise<ToolOutput>;
}

// Example: Custom analysis tool
export class SecurityAnalysisTool extends BaseTool {
  name = 'security-analyze';
  version = '1.0.0';
  description = 'Advanced security analysis for codebases';
  
  getZodSchema() {
    return BaseToolRequestSchema.extend({
      files: z.array(z.string()),
      scan_type: z.enum(['vulnerability', 'compliance', 'secrets']),
      severity_threshold: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    });
  }
  
  async execute(args: any): Promise<ToolOutput> {
    const request = this.validateArgs(args);
    // Custom security analysis logic
    return { status: 'success', content: 'Security analysis complete' };
  }
}
```

### 2. Middleware Plugins (Interception Layer)

Middleware plugins use the Express-inspired pattern to intercept and modify requests/responses:

```typescript
// Middleware Plugin Interface
interface MiddlewarePlugin {
  name: string;
  version: string;
  description: string;
  priority: number; // Execution order (lower = earlier)
  
  // Request middleware
  beforeTool?(request: ToolRequest, context: MiddlewareContext, next: NextFunction): Promise<void>;
  
  // Response middleware
  afterTool?(request: ToolRequest, response: ToolOutput, context: MiddlewareContext, next: NextFunction): Promise<void>;
}

// Example: Logging middleware
export class LoggingMiddleware implements MiddlewarePlugin {
  name = 'request-logger';
  version = '1.0.0';
  description = 'Logs all tool requests and responses';
  priority = 100; // Run early
  
  async beforeTool(request: ToolRequest, context: MiddlewareContext, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] Tool: ${context.toolName}, Args: ${Object.keys(request).join(', ')}`);
    await next();
  }
  
  async afterTool(request: ToolRequest, response: ToolOutput, context: MiddlewareContext, next: NextFunction) {
    console.log(`[${new Date().toISOString()}] Tool: ${context.toolName} completed with status: ${response.status}`);
    await next();
  }
}

// Example: Authentication middleware
export class AuthMiddleware implements MiddlewarePlugin {
  name = 'auth-validator';
  priority = 10; // Run very early
  
  async beforeTool(request: ToolRequest, context: MiddlewareContext, next: NextFunction) {
    // Check for auth token in request
    if (!request.auth_token) {
      throw new Error('Authentication required');
    }
    
    // Validate token and add user info to context
    context.user = await this.validateToken(request.auth_token);
    await next();
  }
}
```

## MCP Resources for Plugin Management

Resources expose plugin information and configuration:

### 1. Plugin Registry Resource

```typescript
// GET plugins://registry
{
  "tools": [
    {
      "name": "security-analyze",
      "version": "1.0.0",
      "description": "Advanced security analysis",
      "source": "@zenode/plugin-security",
      "status": "active"
    }
  ],
  "middleware": [
    {
      "name": "request-logger", 
      "version": "1.0.0",
      "priority": 100,
      "status": "active"
    }
  ]
}
```

### 2. Plugin Configuration Resource

```typescript
// GET plugins://config/{plugin-name}
{
  "name": "security-analyze",
  "config": {
    "default_severity": "medium",
    "scan_patterns": ["*.js", "*.ts"],
    "exclude_paths": ["node_modules/", "dist/"]
  },
  "schema": {
    // Zod schema for configuration validation
  }
}
```

### 3. Middleware Chain Resource

```typescript
// GET plugins://middleware-chain
{
  "chain": [
    { "name": "auth-validator", "priority": 10, "enabled": true },
    { "name": "rate-limiter", "priority": 20, "enabled": true },
    { "name": "request-logger", "priority": 100, "enabled": true },
    { "name": "response-cache", "priority": 200, "enabled": false }
  ]
}
```

## Plugin System Implementation

### Core Plugin Manager

```typescript
class PluginManager {
  private toolPlugins = new Map<string, ToolPlugin>();
  private middlewarePlugins = new Map<string, MiddlewarePlugin>();
  private middlewareChain: MiddlewarePlugin[] = [];

  // Load plugins from npm packages
  async loadPlugin(packageName: string) {
    const plugin = await import(packageName);
    
    if (plugin.default instanceof BaseTool) {
      this.registerToolPlugin(plugin.default);
    } else if (plugin.default.beforeTool || plugin.default.afterTool) {
      this.registerMiddlewarePlugin(plugin.default);
    }
  }

  // Execute tool with middleware chain
  async executeToolWithMiddleware(toolName: string, request: any): Promise<ToolOutput> {
    const tool = this.toolPlugins.get(toolName);
    if (!tool) throw new Error(`Tool not found: ${toolName}`);

    const context: MiddlewareContext = {
      toolName,
      startTime: Date.now(),
      metadata: new Map(),
    };

    // Execute before middleware
    await this.runBeforeMiddleware(request, context);

    // Execute tool
    const response = await tool.execute(request);

    // Execute after middleware
    await this.runAfterMiddleware(request, response, context);

    return response;
  }

  private async runBeforeMiddleware(request: any, context: MiddlewareContext) {
    const chain = this.middlewareChain
      .filter(m => m.beforeTool)
      .sort((a, b) => a.priority - b.priority);
    
    let index = 0;
    const next = async () => {
      if (index < chain.length) {
        const middleware = chain[index++];
        await middleware.beforeTool!(request, context, next);
      }
    };
    
    await next();
  }
}
```

### MCP Server Integration

```typescript
// Add plugin-related resources to MCP server
server.resource(
  'plugin-registry',
  new ResourceTemplate('plugins://registry'),
  async () => ({
    contents: [{
      uri: 'plugins://registry',
      text: JSON.stringify(pluginManager.getRegistryInfo())
    }]
  })
);

server.resource(
  'plugin-config',
  new ResourceTemplate('plugins://config/{pluginName}'),
  async (uri, { pluginName }) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify(pluginManager.getPluginConfig(pluginName))
    }]
  })
);

// Tools are still registered as MCP tools
for (const [name, plugin] of pluginManager.getToolPlugins()) {
  server.tool(
    name,
    plugin.getZodSchema(),
    async (args) => {
      // This goes through the middleware chain
      return pluginManager.executeToolWithMiddleware(name, args);
    }
  );
}
```

## Plugin Development Experience

### Tool Plugin Development

```bash
# Create new tool plugin
npm create @zenode/tool-plugin my-custom-analyzer

# Plugin structure
my-custom-analyzer/
├── package.json
├── src/
│   ├── index.ts        # Main tool export
│   ├── schema.ts       # Zod schemas
│   └── prompts.ts      # System prompts
├── tests/
└── README.md
```

```json
{
  "name": "@zenode/plugin-custom-analyzer",
  "keywords": ["zenode-plugin", "zenode-tool"],
  "main": "dist/index.js",
  "zenode": {
    "type": "tool",
    "category": "analysis"
  }
}
```

### Middleware Plugin Development

```bash
# Create new middleware plugin  
npm create @zenode/middleware-plugin request-validator

# Plugin structure
request-validator/
├── package.json
├── src/
│   ├── index.ts        # Main middleware export
│   ├── config.ts       # Configuration schema
│   └── validators.ts   # Validation logic
├── tests/
└── README.md
```

```json
{
  "name": "@zenode/middleware-request-validator", 
  "keywords": ["zenode-plugin", "zenode-middleware"],
  "zenode": {
    "type": "middleware",
    "priority": 50
  }
}
```

## Plugin Discovery and Installation

### Automatic Discovery

```typescript
// Auto-discover plugins in package.json
async function discoverPlugins() {
  const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
  const plugins = [];
  
  for (const [name, version] of Object.entries(packageJson.dependencies)) {
    if (name.startsWith('@zenode/plugin-') || name.startsWith('@zenode/middleware-')) {
      plugins.push(name);
    }
  }
  
  return plugins;
}
```

### Plugin Installation

```bash
# Install tool plugin
npm install @zenode/plugin-security-analyzer

# Install middleware plugin  
npm install @zenode/middleware-rate-limiter

# Server automatically discovers and loads plugins on restart
npm run dev
```

## Benefits of This Architecture

### 1. **Separation of Concerns**
- Tools focus on execution logic
- Middleware handles cross-cutting concerns (auth, logging, caching)
- Resources provide management interface

### 2. **Composability** 
- Middleware plugins can be combined in any order
- Tool plugins are independent but can share middleware
- Standard npm ecosystem for distribution

### 3. **MCP Compliance**
- Tools expose as standard MCP tools
- Resources provide plugin metadata
- Maintains compatibility with existing MCP clients

### 4. **Developer Experience**
- Familiar Express-style middleware pattern
- TypeScript support with Zod validation
- Simple npm-based distribution

### 5. **Extensibility**
- Third parties can create both tool and middleware plugins
- Plugin marketplace through npm
- Resource-based configuration management

## Migration Path

1. **Phase 1**: Implement plugin manager and middleware system
2. **Phase 2**: Add MCP resources for plugin discovery 
3. **Phase 3**: Convert existing tools to plugin format (optional)
4. **Phase 4**: Create plugin development SDK and documentation
5. **Phase 5**: Open plugin marketplace/registry

This design creates a robust, extensible plugin ecosystem while maintaining full MCP compliance and providing both execution (tools) and interception (middleware) capabilities.