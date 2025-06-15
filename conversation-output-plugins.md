# Plugin Architecture Design for Zen MCP Server

## Overview

This document outlines plugin architecture patterns for converting the current hardcoded tool system into an extensible plugin-based architecture where tools can be distributed as npm packages.

## Current System Context

The Zen MCP Server currently has 7 hardcoded AI tools:
- chat - General development conversations
- thinkdeep - Extended reasoning with thinking modes
- codereview - Professional code review with severity levels
- precommit - Git change validation across repositories
- debug - Root cause analysis and debugging
- analyze - General file/code analysis
- testgen - Comprehensive test generation

## Key Requirements

- Tools need to integrate with MCP (Model Context Protocol)
- Each tool has configuration (model selection, parameters)
- Tools share common functionality (provider routing, conversation threading)
- Need to maintain type safety with TypeScript
- Should be easy for third-party developers to create new tools

## Plugin Architecture Patterns

### 1. Interface-Based Plugin System (Recommended)

```typescript
interface ToolPlugin {
  name: string;
  version: string;
  execute(params: ToolParams): Promise<ToolResult>;
  getSchema(): ToolSchema;
}
```

**Benefits**: 
- Type-safe with TypeScript interfaces
- Easy to implement and understand
- Maintains MCP compliance
- Clear contract for third-party developers

**Implementation**:
```typescript
// Example tool plugin
export class AnalyzeToolPlugin implements ToolPlugin {
  name = 'analyze';
  version = '1.0.0';
  
  async execute(params: ToolParams): Promise<ToolResult> {
    // Tool implementation
  }
  
  getSchema(): ToolSchema {
    // Return MCP tool schema
  }
}
```

### 2. Factory Pattern with Registry

```typescript
class ToolRegistry {
  private tools = new Map<string, ToolFactory>();
  
  register(factory: ToolFactory): void {
    this.tools.set(factory.name, factory);
  }
  
  create(name: string, config: Config): ToolPlugin {
    const factory = this.tools.get(name);
    return factory?.create(config);
  }
}
```

**Benefits**:
- Dynamic loading of tools
- Dependency injection capabilities
- Configuration management
- Runtime tool registration

**Use case**: Load tools from `package.json` dependencies

### 3. Decorator-Based Registration

```typescript
@Tool('analyze', { schema: analyzeSchema })
class AnalyzeTool extends BaseTool {
  async execute(params: ToolParams): Promise<ToolResult> {
    // Implementation
  }
}
```

**Benefits**:
- Clean, declarative syntax
- Automatic registration
- Metadata handling
- Reduced boilerplate

**Tradeoffs**: 
- Requires experimental decorators
- Less explicit than interface-based approach

### 4. Module Discovery Pattern

```typescript
// Auto-discover tools in node_modules/@zenode/tool-*
const tools = await discoverTools('@zenode/tool-*');

async function discoverTools(pattern: string): Promise<ToolPlugin[]> {
  const packages = await glob(pattern, { cwd: 'node_modules' });
  return Promise.all(
    packages.map(pkg => import(pkg).then(m => m.default))
  );
}
```

**Benefits**:
- Zero-config plugin loading
- Seamless npm ecosystem integration
- Convention-based discovery
- Automatic tool registration

**Implementation**: Use `glob` to find matching packages

## Recommended Architecture

For the Zen MCP Server, we recommend combining **Interface-Based Plugin System** with **Factory Pattern and Registry**:

### Core Components

1. **Base Tool Interface**
```typescript
interface ToolPlugin {
  name: string;
  version: string;
  description: string;
  execute(params: ToolParams, context: ToolContext): Promise<ToolResult>;
  getSchema(): ToolSchema;
  validateParams?(params: unknown): params is ToolParams;
}
```

2. **Tool Registry**
```typescript
class ToolRegistry {
  private plugins = new Map<string, ToolPlugin>();
  
  register(plugin: ToolPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }
  
  get(name: string): ToolPlugin | undefined {
    return this.plugins.get(name);
  }
  
  list(): ToolPlugin[] {
    return Array.from(this.plugins.values());
  }
}
```

3. **Plugin Loader**
```typescript
class PluginLoader {
  async loadFromPackage(packageName: string): Promise<ToolPlugin> {
    const module = await import(packageName);
    return module.default || module.tool;
  }
  
  async discoverPlugins(pattern = '@zenode/tool-*'): Promise<ToolPlugin[]> {
    // Auto-discover tools matching pattern
  }
}
```

### Shared Functionality

Provide common functionality through base classes or utilities:

```typescript
abstract class BaseTool implements ToolPlugin {
  abstract name: string;
  abstract version: string;
  abstract description: string;
  
  // Shared functionality
  protected async callProvider(model: string, prompt: string): Promise<string> {
    // Provider routing logic
  }
  
  protected async getConversation(threadId: string): Promise<Conversation> {
    // Conversation threading
  }
}
```

### Package Distribution

Tools would be distributed as npm packages with this structure:

```
@zenode/tool-analyze/
├── package.json
├── src/
│   └── index.ts
└── README.md
```

```json
{
  "name": "@zenode/tool-analyze",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["zenode", "mcp", "tool"],
  "peerDependencies": {
    "@zenode/core": "^1.0.0"
  }
}
```

## Migration Strategy

1. **Extract Base Tool Functionality**: Create shared base classes and utilities
2. **Define Plugin Interfaces**: Establish TypeScript interfaces for plugins
3. **Implement Plugin Registry**: Create registration and discovery system
4. **Convert Existing Tools**: Refactor current tools to use plugin interface
5. **Create Plugin SDK**: Provide tooling for third-party developers
6. **Package Distribution**: Set up npm publishing for core tools

## Benefits of This Approach

- **Type Safety**: TypeScript interfaces ensure compile-time checking
- **Extensibility**: Easy for third-party developers to create tools
- **Maintainability**: Clear separation of concerns
- **Compatibility**: Maintains MCP protocol compliance
- **Performance**: Efficient plugin loading and execution
- **Developer Experience**: Good tooling and documentation support

## Third-Party Developer Experience

With this architecture, creating a new tool would be as simple as:

```bash
npm install @zenode/core
npm install @zenode/tool-sdk
```

```typescript
import { BaseTool, ToolParams, ToolResult } from '@zenode/core';

export default class CustomTool extends BaseTool {
  name = 'custom-tool';
  version = '1.0.0';
  description = 'My custom AI tool';
  
  async execute(params: ToolParams): Promise<ToolResult> {
    // Custom tool logic
    return { success: true, data: 'result' };
  }
  
  getSchema() {
    return {
      type: 'object',
      properties: {
        // Tool parameter schema
      }
    };
  }
}
```

This provides a solid foundation for an extensible AI tool system that balances flexibility, maintainability, and type safety.