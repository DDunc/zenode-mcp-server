# MCP Plugin Architecture: Express Middleware Inspired Design

## 🗣️ Chat Tool: "Express Middleware Patterns for MCP"

Hey team! I've been thinking about how we could apply Express.js middleware patterns to our MCP plugin architecture. The Express ecosystem is incredibly successful - there are thousands of middleware packages because the pattern is so simple and powerful.

The key insight is Express's function signature: `(req, res, next) => void`. This creates a pipeline where each middleware can:
- Inspect and modify the request
- Add data to the response
- Call `next()` to continue the chain
- Handle errors with `next(error)`

For MCP tools, we could adapt this pattern. Instead of direct `execute(params, context)`, we could have middleware that runs before/after tool execution.

## 🤔 ThinkDeep Tool: "Deep Analysis of Middleware Patterns"

*Thinking deeply about the architectural implications...*

The Express middleware pattern succeeds because it solves several fundamental problems:

1. **Composability**: Middleware can be combined in any order
2. **Separation of Concerns**: Each middleware has a single responsibility
3. **Shared State**: The req/res objects flow through the entire chain
4. **Error Handling**: Centralized error handling through the `next(error)` pattern
5. **Plugin Ecosystem**: Simple interface = easy third-party development

For MCP tools, we could create a similar pattern:

```typescript
// MCP Middleware Signature
type MCPMiddleware = (
  request: MCPRequest,
  response: MCPResponse, 
  context: ToolContext,
  next: NextFunction
) => Promise<void>;

// Tool with middleware chain
class ToolWithMiddleware {
  private middleware: MCPMiddleware[] = [];
  
  use(middleware: MCPMiddleware) {
    this.middleware.push(middleware);
  }
  
  async execute(params: any, context: ToolContext) {
    const request = new MCPRequest(params);
    const response = new MCPResponse();
    
    // Execute middleware chain
    await this.runMiddleware(request, response, context);
    
    // Execute core tool logic
    const result = await this.coreExecute(request, response, context);
    
    return response.toJSON();
  }
}
```

This pattern would enable:
- **Pre-processing middleware**: Validation, authentication, logging
- **Post-processing middleware**: Response transformation, caching
- **Cross-cutting concerns**: Metrics, tracing, error handling

## 🔍 Analyze Tool: "Current Architecture Analysis"

Looking at our current tool architecture, we have:

```typescript
abstract class BaseTool {
  abstract execute(params: any, context: ToolContext): Promise<any>;
}
```

This is a direct execution model. To introduce middleware, we'd need:

**1. Request/Response Objects**
```typescript
class MCPRequest {
  constructor(public params: any) {}
  
  // Middleware can modify params
  setParam(key: string, value: any) {
    this.params[key] = value;
  }
  
  // Middleware can add metadata
  metadata: Map<string, any> = new Map();
}

class MCPResponse {
  private data: any = {};
  private headers: Map<string, any> = new Map();
  
  setData(data: any) { this.data = data; }
  setHeader(key: string, value: any) { this.headers.set(key, value); }
  
  toJSON() {
    return {
      data: this.data,
      headers: Object.fromEntries(this.headers)
    };
  }
}
```

**2. Middleware Chain Execution**
```typescript
class MiddlewareChain {
  private middleware: MCPMiddleware[] = [];
  
  use(middleware: MCPMiddleware) {
    this.middleware.push(middleware);
  }
  
  async execute(request: MCPRequest, response: MCPResponse, context: ToolContext) {
    let index = 0;
    
    const next = async (error?: Error) => {
      if (error) throw error;
      
      if (index >= this.middleware.length) return;
      
      const middleware = this.middleware[index++];
      await middleware(request, response, context, next);
    };
    
    await next();
  }
}
```

## 🔧 Debug Tool: "Implementation Challenges"

I see several challenges with this approach:

**1. Compatibility with Existing Tools**
Our current tools expect `execute(params, context)`. Introducing middleware would be a breaking change unless we:
- Make it opt-in for new tools
- Provide a compatibility layer
- Use a decorator pattern

**2. Error Handling Complexity**
Express error handling is synchronous. MCP tools are async. We'd need:
```typescript
type NextFunction = (error?: Error) => Promise<void>;

// Error middleware signature
type ErrorMiddleware = (
  error: Error,
  request: MCPRequest,
  response: MCPResponse,
  context: ToolContext,
  next: NextFunction
) => Promise<void>;
```

**3. Provider Integration**
Our tools rely heavily on the provider system. Middleware would need access to:
- Provider registry
- Conversation threading
- Model selection logic

This could lead to tight coupling between middleware and our custom systems.

## 🧪 TestGen Tool: "Testing Middleware Patterns"

For testing, middleware patterns would actually be beneficial:

```typescript
describe('Tool Middleware', () => {
  it('should execute middleware in order', async () => {
    const tool = new ToolWithMiddleware();
    const executionOrder: string[] = [];
    
    tool.use(async (req, res, ctx, next) => {
      executionOrder.push('middleware1');
      await next();
    });
    
    tool.use(async (req, res, ctx, next) => {
      executionOrder.push('middleware2');
      await next();
    });
    
    await tool.execute({}, mockContext);
    
    expect(executionOrder).toEqual(['middleware1', 'middleware2']);
  });
});
```

Middleware would make tools more testable by:
- Allowing isolated testing of middleware functions
- Enabling mock middleware for testing
- Providing clear separation of concerns

## 📋 PreCommit Tool: "Production Readiness Assessment"

Before implementing middleware patterns, we need to consider:

**Pros:**
- ✅ Enhanced composability and reusability
- ✅ Better separation of concerns
- ✅ Easier third-party plugin development
- ✅ Consistent error handling patterns
- ✅ Cross-cutting concerns (logging, metrics, auth)

**Cons:**
- ❌ Added complexity to the core architecture
- ❌ Potential performance overhead
- ❌ Breaking changes to existing tools
- ❌ More complex debugging (middleware chain)
- ❌ Requires significant refactoring

**Migration Strategy:**
1. **Phase 1**: Implement middleware system alongside existing tools
2. **Phase 2**: Create adapter layer for backward compatibility
3. **Phase 3**: Gradually migrate existing tools to middleware pattern
4. **Phase 4**: Deprecate old direct execution model

## 🔄 Consensus: Hybrid Approach

After this discussion, I think we should consider a **hybrid approach**:

```typescript
// New middleware-enabled base class
abstract class MiddlewareBaseTool extends BaseTool {
  private middleware = new MiddlewareChain();
  
  use(middleware: MCPMiddleware) {
    this.middleware.use(middleware);
    return this;
  }
  
  async execute(params: any, context: ToolContext) {
    const request = new MCPRequest(params);
    const response = new MCPResponse();
    
    // Run middleware chain
    await this.middleware.execute(request, response, context);
    
    // Execute core tool logic
    const result = await this.coreExecute(request, response, context);
    
    return response.toJSON();
  }
  
  // Tools override this instead of execute
  abstract coreExecute(
    request: MCPRequest, 
    response: MCPResponse, 
    context: ToolContext
  ): Promise<any>;
}

// Existing tools can still use direct execution
abstract class BaseTool {
  abstract execute(params: any, context: ToolContext): Promise<any>;
}
```

This allows:
- Existing tools to continue working unchanged
- New tools to opt into middleware patterns
- Gradual migration path
- Backward compatibility

**Example Middleware Packages:**
```bash
npm install @zenode/middleware-auth
npm install @zenode/middleware-logging  
npm install @zenode/middleware-cache
npm install @zenode/middleware-validation
```

**Usage:**
```typescript
class MyTool extends MiddlewareBaseTool {
  constructor() {
    super();
    this.use(authMiddleware);
    this.use(loggingMiddleware);
    this.use(validationMiddleware);
  }
  
  async coreExecute(request, response, context) {
    // Core tool logic here
    // Middleware has already run
    return { result: 'processed' };
  }
}
```

This Express-inspired approach could significantly enhance our plugin ecosystem while maintaining compatibility with existing tools.