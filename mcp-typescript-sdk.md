# MCP TypeScript SDK Documentation

## Core Concepts

Model Context Protocol (MCP) is a standardized way to expose data and functionality to LLM applications. Key components include:

- **Servers**: Expose capabilities to MCP clients
- **Resources**: Data endpoints (like GET endpoints)  
- **Tools**: Executable functionality
- **Prompts**: Reusable interaction templates

## Server Implementation

### Basic Server Setup
```typescript
const server = new McpServer({
  name: "My App",
  version: "1.0.0"
});
```

### Transport Options

#### 1. Stdio Transport (for command-line tools)
```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

#### 2. Streamable HTTP (for remote servers)
- Supports session management
- Handles client requests and server-to-client notifications

## Key Features

### 1. Resources: Expose Data
Resources are like GET endpoints that expose data:

```typescript
server.resource(
  "user-profile",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  async (uri, { userId }) => ({
    contents: [{
      uri: uri.href,
      text: `Profile data for user ${userId}`
    }]
  })
);
```

### 2. Tools: Provide Executable Functionality
Tools are functions that can be called by MCP clients:

```typescript
server.tool(
  "calculate-bmi",
  { 
    weightKg: z.number(), 
    heightM: z.number() 
  },
  async ({ weightKg, heightM }) => ({
    content: [{
      type: "text",
      text: String(weightKg / (heightM * heightM))
    }]
  })
);
```

### 3. Prompts: Create Reusable Interaction Templates
Prompts define reusable conversation starters:

```typescript
server.prompt(
  "review-code",
  { code: z.string() },
  ({ code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please review this code:\n\n${code}`
      }
    }]
  })
);
```

## Key Architectural Principles

### Strongly Typed with Zod Validation
- All inputs validated with Zod schemas
- Type safety throughout the application
- Runtime validation and compile-time types

### Explicit Separation of Concerns
- Clear distinction between resources, tools, and prompts
- Each serves a different purpose in the MCP ecosystem
- Modular and composable design

### Flexible Transport Mechanisms
- Multiple transport options (stdio, HTTP)
- Transport-agnostic server implementation
- Easy to add new transport methods

### Built-in Error Handling
- Standardized error responses
- Proper HTTP status codes for web transports
- Graceful degradation

## Server Lifecycle

```typescript
// 1. Create server
const server = new McpServer({ name: "MyServer", version: "1.0.0" });

// 2. Register capabilities
server.tool("my-tool", schema, handler);
server.resource("my-resource", template, handler);
server.prompt("my-prompt", schema, handler);

// 3. Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);

// 4. Server runs until transport closes
```

## Comparison with Current Zenode Implementation

### Similarities
- Both use TypeScript for type safety
- Both implement MCP protocol
- Both support tool execution

### Key Differences

| Aspect | Official SDK | Zenode Current |
|--------|-------------|----------------|
| **Architecture** | Resources + Tools + Prompts | Tools only |
| **Validation** | Zod schemas | Custom validation |
| **Transport** | Multiple transports | stdio only |
| **Provider System** | Not included | Multi-provider AI orchestration |
| **Conversation Threading** | Not included | Redis-based persistence |
| **Model Selection** | Not included | Auto model selection |

### What Zenode Adds Beyond Standard MCP
- **Multi-Provider AI Orchestration**: Gemini, OpenAI, OpenRouter support
- **Conversation Threading**: Persistent conversations across tool calls
- **Intelligent Model Selection**: Auto mode for optimal model choice
- **Advanced Tool Parameters**: thinking_mode, temperature, etc.
- **Custom Features**: Web search, file analysis, etc.

## Official SDK Best Practices

### 1. Use Zod for Input Validation
```typescript
import { z } from 'zod';

const schema = z.object({
  file_path: z.string(),
  analysis_type: z.enum(['security', 'performance', 'quality'])
});
```

### 2. Return Proper Content Types
```typescript
// Text content
{ type: "text", text: "Result text" }

// Error responses  
{ type: "text", text: "Error: Something went wrong" }
```

### 3. Use Resource Templates for URI Patterns
```typescript
new ResourceTemplate("files://{path}", { list: undefined })
```

### 4. Implement Graceful Error Handling
```typescript
try {
  const result = await performOperation();
  return { content: [{ type: "text", text: result }] };
} catch (error) {
  return { 
    content: [{ 
      type: "text", 
      text: `Error: ${error.message}` 
    }],
    isError: true 
  };
}
```

## Conformance Recommendations

To better align with the official MCP TypeScript SDK while preserving Zenode's advanced features:

### 1. Adopt Zod Validation
Replace custom validation with Zod schemas for all tool inputs

### 2. Standardize Response Format
Use the official content format: `{ type: "text", text: string }`

### 3. Consider Resource Support
Add support for MCP resources alongside tools

### 4. Maintain Custom Extensions
Keep advanced features as optional extensions to the standard MCP pattern

### 5. Transport Flexibility
Consider supporting multiple transports while maintaining stdio as primary