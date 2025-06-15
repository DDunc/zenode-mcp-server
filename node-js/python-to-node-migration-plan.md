# Python to Node.js Migration Plan for Zenode MCP Server

## Overview

This document outlines the comprehensive plan for migrating the Zen MCP Server from Python to Node.js, creating the **Zenode MCP Server**. The migration will maintain all functionality while leveraging Node.js's event-driven architecture and JavaScript ecosystem.

## Project Scope

### What Changes
- **Language**: Python → TypeScript/JavaScript (Node.js)
- **Package Manager**: pip → npm/yarn
- **Project Name**: "zen" → "zenode" (in all strings and references)
- **Testing Framework**: pytest → Jest/Vitest
- **Code Quality**: Black/Ruff → ESLint/Prettier

### What Remains the Same
- MCP Protocol implementation and communication
- All 7 AI tools functionality (chat, thinkdeep, codereview, precommit, debug, analyze, testgen)
- Provider architecture (Gemini, OpenAI, OpenRouter, Custom)
- Redis-based conversation threading
- Docker deployment approach
- Environment variable configuration
- Tool interfaces and signatures

## Technology Stack

### Core Runtime
- **Node.js**: v20.x LTS (latest stable LTS version)
- **TypeScript**: 5.x for type safety
- **Package Manager**: npm (included with Node.js)

### Key Dependencies
```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "@google/generative-ai": "latest",
  "openai": "^4.0.0",
  "redis": "^4.0.0",
  "zod": "^3.0.0",
  "dotenv": "^16.0.0",
  "winston": "^3.0.0",
  "axios": "^1.0.0"
}
```

### Development Dependencies
```json
{
  "@types/node": "^20.0.0",
  "typescript": "^5.0.0",
  "@typescript-eslint/eslint-plugin": "^6.0.0",
  "@typescript-eslint/parser": "^6.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0",
  "jest": "^29.0.0",
  "@types/jest": "^29.0.0",
  "ts-jest": "^29.0.0",
  "nodemon": "^3.0.0",
  "tsx": "^4.0.0"
}
```

## Directory Structure

```
zenode-mcp-server/
├── package.json                    # Project metadata and dependencies
├── tsconfig.json                   # TypeScript configuration
├── .env.example                    # Environment variables template
├── jest.config.js                  # Jest testing configuration
├── .eslintrc.js                    # ESLint configuration
├── .prettierrc                     # Prettier configuration
├── Dockerfile                      # Docker container definition
├── docker-compose.yml              # Multi-service orchestration
│
├── src/
│   ├── index.ts                    # Main entry point (equivalent to server.py)
│   ├── config.ts                   # Configuration and constants
│   ├── types/                      # TypeScript type definitions
│   │   ├── mcp.d.ts               # MCP protocol types
│   │   ├── providers.d.ts         # Provider interfaces
│   │   └── tools.d.ts             # Tool interfaces
│   │
│   ├── providers/                  # AI model provider implementations
│   │   ├── base.ts                # Abstract base provider
│   │   ├── registry.ts            # Provider registry and routing
│   │   ├── gemini.ts              # Google Gemini provider
│   │   ├── openai.ts              # OpenAI provider
│   │   ├── openrouter.ts          # OpenRouter provider
│   │   └── custom.ts              # Custom endpoints provider
│   │
│   ├── tools/                      # MCP tool implementations
│   │   ├── base.ts                # Abstract base tool
│   │   ├── models.ts              # Tool request/response models
│   │   ├── chat.ts                # Chat tool
│   │   ├── thinkdeep.ts           # ThinkDeep tool
│   │   ├── codereview.ts          # Code review tool
│   │   ├── precommit.ts           # Pre-commit validation tool
│   │   ├── debug.ts               # Debug tool
│   │   ├── analyze.ts             # Analyze tool
│   │   └── testgen.ts             # Test generation tool
│   │
│   └── utils/                      # Utility modules
│       ├── conversation-memory.ts  # Redis conversation threading
│       ├── file-utils.ts          # File operations
│       ├── git-utils.ts           # Git operations
│       ├── model-context.ts       # Token management
│       ├── model-restrictions.ts  # Model usage restrictions
│       └── token-utils.ts         # Token counting
│
├── systemprompts/                  # AI prompt templates (unchanged)
├── conf/                           # Configuration files
│   └── custom_models.json         # Model aliases (unchanged)
└── tests/                          # Jest test suites
    ├── unit/                      # Unit tests
    ├── integration/               # Integration tests
    └── fixtures/                  # Test data and mocks
```

## Migration Phases

### Phase 1: Project Setup and Core Infrastructure (Week 1)
1. **Initialize Node.js project**
   - Create package.json with all dependencies
   - Set up TypeScript configuration
   - Configure ESLint and Prettier
   - Set up Jest for testing

2. **Create type definitions**
   - Define interfaces for MCP protocol
   - Create provider and tool interfaces
   - Define request/response types

3. **Implement configuration module**
   - Port config.py to config.ts
   - Set up environment variable handling with dotenv
   - Define constants and defaults

### Phase 2: MCP Server Implementation (Week 1-2)
1. **Port server.py to index.ts**
   - Set up MCP SDK server instance
   - Implement stdio communication
   - Create tool registration system
   - Handle JSON-RPC protocol

2. **Implement logging system**
   - Set up Winston logger
   - Configure file rotation
   - Implement activity logging

3. **Create health check and monitoring**
   - Port Docker health check logic
   - Implement startup validation

### Phase 3: Provider System (Week 2-3)
1. **Base provider architecture**
   - Port base.py to base.ts
   - Implement temperature constraints
   - Create model capabilities system

2. **Provider implementations**
   - Gemini provider with google-generative-ai SDK
   - OpenAI provider with openai SDK
   - OpenRouter provider with axios
   - Custom provider for local models

3. **Provider registry**
   - Port registry.py logic
   - Implement provider discovery
   - Create model routing system

### Phase 4: Tool System (Week 3-4)
1. **Base tool implementation**
   - Port base.py tool logic
   - Implement request validation with Zod
   - Create response formatting

2. **Individual tool migrations**
   - Chat tool
   - ThinkDeep tool (with thinking modes)
   - CodeReview tool
   - Precommit tool
   - Debug tool
   - Analyze tool
   - TestGen tool

3. **Tool-specific features**
   - File path security validation
   - Token limit checking
   - Conversation continuation

### Phase 5: Utilities and Support (Week 4-5)
1. **Conversation memory**
   - Redis client setup
   - Thread management
   - Context reconstruction

2. **File and Git utilities**
   - File reading with security checks
   - Git repository operations
   - Path translation

3. **Token management**
   - Token counting implementation
   - Context window management
   - Dynamic allocation

### Phase 6: Testing and Validation (Week 5-6)
1. **Unit tests**
   - Provider tests
   - Tool tests
   - Utility tests

2. **Integration tests**
   - End-to-end MCP communication
   - Multi-tool conversations
   - Provider failover

3. **Performance testing**
   - Concurrent request handling
   - Memory usage profiling
   - Response time benchmarks

### Phase 7: Docker and Deployment (Week 6)
1. **Update Docker configuration**
   - Node.js base image
   - Multi-stage build for optimization
   - Production dependencies only

2. **Docker Compose updates**
   - Service configuration
   - Health checks
   - Log monitoring

3. **Documentation**
   - Update README
   - API documentation
   - Migration guide

## Key Migration Considerations

### 1. Async/Await Patterns
Python's `async def` → TypeScript's `async function`
- Direct translation for most async patterns
- Use Promises instead of Python's asyncio

### 2. Type Safety
- Leverage TypeScript's type system
- Use interfaces for all API contracts
- Implement strict null checks

### 3. Error Handling
Python's `try/except` → TypeScript's `try/catch`
- Create custom error classes
- Implement proper error serialization

### 4. Module System
- Use ES modules (import/export)
- Maintain similar file organization
- Implement barrel exports for cleaner imports

### 5. Testing Strategy
- Jest for unit and integration tests
- Mock Redis and external APIs
- Maintain test coverage above 80%

### 6. Performance Optimizations
- Use Node.js streams for large files
- Implement connection pooling for Redis
- Optimize concurrent request handling

## Python-to-Node.js Translation Guide

### Common Patterns

| Python | Node.js/TypeScript |
|--------|-------------------|
| `from module import func` | `import { func } from './module'` |
| `async def function():` | `async function functionName() {` |
| `f"string {variable}"` | `` `string ${variable}` `` |
| `try: ... except Exception as e:` | `try { ... } catch (error) {` |
| `None` | `null` or `undefined` |
| `True/False` | `true/false` |
| `dict` | `object` or `Map` |
| `list` | `array` |
| `if __name__ == "__main__":` | `if (require.main === module) {` |

### Dependency Equivalents

| Python Package | Node.js Package | Purpose |
|---------------|-----------------|---------|
| `mcp` | `@modelcontextprotocol/sdk` | MCP protocol implementation |
| `google-genai` | `@google/generative-ai` | Gemini API client |
| `openai` | `openai` | OpenAI API client |
| `pydantic` | `zod` | Schema validation |
| `redis` | `redis` | Redis client |
| `pytest` | `jest` | Testing framework |
| `logging` | `winston` | Logging library |
| `os.getenv` | `process.env` | Environment variables |

### File I/O Patterns

Python:
```python
with open(file_path, 'r') as f:
    content = f.read()
```

Node.js:
```typescript
import { readFile } from 'fs/promises';
const content = await readFile(filePath, 'utf-8');
```

### Class Translation

Python:
```python
class BaseTool(ABC):
    @abstractmethod
    def get_name(self) -> str:
        pass
```

TypeScript:
```typescript
abstract class BaseTool {
    abstract getName(): string;
}
```

## Configuration Management

### Environment Variables
Maintain the same environment variable names:
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`
- `CUSTOM_API_URL`
- `CUSTOM_API_KEY`
- `CUSTOM_MODEL_NAME`
- `DEFAULT_MODEL`
- `LOG_LEVEL`
- `REDIS_URL`

### Model Configuration
Keep `conf/custom_models.json` format unchanged for compatibility.

## Risk Mitigation

1. **Feature Parity Testing**
   - Create comprehensive test suite comparing Python and Node.js outputs
   - Validate all tool responses match exactly

2. **Performance Benchmarking**
   - Compare response times
   - Monitor memory usage
   - Test concurrent request handling

3. **Gradual Rollout**
   - Run both versions in parallel initially
   - A/B test with subset of users
   - Monitor error rates and performance

4. **Rollback Plan**
   - Keep Python version maintained during transition
   - Document any breaking changes
   - Provide migration scripts for configurations

## Success Criteria

1. **Functional Requirements**
   - All 7 tools work identically to Python version
   - MCP protocol compliance verified
   - Conversation threading works across tools

2. **Performance Requirements**
   - Response times within 10% of Python version
   - Memory usage not exceeding Python by >20%
   - Support for 100+ concurrent connections

3. **Quality Requirements**
   - 80%+ test coverage
   - No critical security vulnerabilities
   - ESLint compliance with no errors

4. **Documentation Requirements**
   - Complete API documentation
   - Setup and deployment guides
   - Troubleshooting documentation

## Timeline Summary

- **Week 1**: Project setup and core infrastructure
- **Week 2**: MCP server and provider system basics
- **Week 3**: Complete provider system and start tools
- **Week 4**: Complete tool implementations
- **Week 5**: Utilities, testing, and validation
- **Week 6**: Docker, deployment, and documentation

Total estimated time: 6 weeks for complete migration with full testing and documentation.