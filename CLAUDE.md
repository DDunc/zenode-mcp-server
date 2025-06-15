# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**ZENODE MCP SERVER**: This is the Node.js/TypeScript port of the original Python Zen MCP Server. The Python code in this repository is maintained for reference and feature parity purposes only.

**ACTIVE DEVELOPMENT**: Focus on the `zenode/` directory which contains the Node.js implementation. The Python code serves as reference for understanding the original architecture and ensuring feature parity.

**MIGRATION GOAL**: Convert this entire Python-based Zen MCP Server to Node.js while maintaining all functionality and architecture patterns.

**DEVELOPER CONTEXT**: The developer working on this project is a Python novice with strong JavaScript/TypeScript/Node.js/bash experience. When working with the existing Python code, explain Python concepts, ecosystem, toolchain, and syntax as if teaching someone who understands JS/TS/Node.js but is new to Python.

This repository contains both:
- **zenode/** - The active Node.js/TypeScript implementation 
- **Python files** - Reference implementation for feature parity (read-only for comparison)

The goal is to maintain the Node.js implementation while preserving:
- All AI tools (chat, thinkdeep, codereview, precommit, debug, analyze, testgen, etc.)
- Multi-provider architecture (Gemini, OpenAI, OpenRouter, custom endpoints)
- Conversation threading with Redis
- Docker-based deployment
- MCP protocol compliance

## Python-to-Node.js Migration Resources

### Key Node.js Equivalents
- **MCP Protocol**: Use `@modelcontextprotocol/sdk` npm package
- **Async/Await**: Direct equivalent in Node.js (same patterns)
- **HTTP Clients**: `axios` or `fetch` for API calls (replaces `requests`)
- **Redis Client**: `redis` npm package (replaces `redis-py`)
- **Validation**: `zod` or `joi` (replaces `pydantic`)
- **Environment Variables**: `dotenv` package (replaces `os.getenv`)
- **File Operations**: Node.js `fs/promises` (replaces Python file I/O)
- **Subprocess**: `child_process` (replaces Python `subprocess`)

### Architecture Migration Strategy
1. **Start with Core**: Convert `server.js` and MCP protocol handling first
2. **Provider System**: Migrate provider abstractions and registry
3. **Tool System**: Convert each tool individually, maintaining interfaces
4. **Configuration**: Migrate environment handling and model configs
5. **Utilities**: Convert helper functions and conversation memory
6. **Testing**: Migrate pytest tests to Jest/Vitest
7. **Docker**: Update Dockerfile for Node.js runtime

### TypeScript Recommendations
- Use TypeScript for better type safety (equivalent to Python typing)
- Define interfaces for all provider responses and tool inputs
- Maintain strict typing for MCP protocol messages
- Use discriminated unions for different model providers

### Best Practices for Migration
- **Maintain File Structure**: Keep similar directory organization
- **Preserve API Contracts**: Ensure MCP tool interfaces remain identical
- **Async Patterns**: Use Promise-based async/await (same as Python)
- **Error Handling**: Use try/catch blocks (equivalent to Python try/except)
- **Logging**: Use `winston` or `pino` (replaces Python logging)
- **Testing**: Jest for unit tests, maintain same test coverage
- **Package Management**: Use npm/yarn (replaces pip/requirements.txt)

### Python Concepts for JS/TS Developers
- **`requirements.txt`** = `package.json` dependencies list
- **`pip install`** = `npm install` 
- **Virtual environments (`venv`)** = `node_modules` isolation (but at project level)
- **`__init__.py`** = Makes directories into modules (like `index.js` barrel exports)
- **`import from module`** = `import { } from 'module'` (similar ES6 syntax)
- **`f"string {variable}"`** = Template literals with `${variable}`
- **`async def function():`** = `async function()` (same concept)
- **`try/except`** = `try/catch` (same logic, different keywords)
- **`None`** = `null/undefined`
- **`True/False`** = `true/false` (capitalized in Python)
- **List comprehensions `[x for x in items]`** = Array methods like `.map()`
- **Python dictionaries `{key: value}`** = JavaScript objects
- **Type hints `def func(x: str) -> int:`** = TypeScript function signatures

## Node.js Development Commands (Zenode)

### Testing
- **Run all tests**: `npm test` (in zenode/ directory)
- **Run specific test file**: `npm test -- --testNamePattern="specific test"`
- **Run with verbose output**: `npm test -- --verbose`
- **Run with coverage**: `npm run test:coverage`

### Code Quality
- **Format code**: `npm run format`
- **Lint code**: `npm run lint`
- **Fix linting issues**: `npm run lint:fix`
- **Type check**: `npm run type-check`

### Docker Development
- **Build and start server**: `cd zenode && ./run-server.sh`
- **View server logs**: `docker logs zenode-mcp-server -f`
- **Stop services**: `docker compose down`
- **Rebuild after changes**: `./run-server.sh` (automatically rebuilds)

### Local Development
- **Install dependencies**: `cd zenode && npm install`
- **Run server directly**: `npm run dev` (development mode with hot reload)
- **Build**: `npm run build`
- **Start production**: `npm start`

## Python Reference Commands (Original Zen - For Reference Only)

**NOTE: These commands are for the original Python implementation and should only be used for reference when ensuring feature parity.**

### Code Quality Checks

Before making any changes or submitting PRs, always run the comprehensive quality checks:

```bash
# Activate virtual environment first
source venv/bin/activate

# Run all quality checks (linting, formatting, tests)
./code_quality_checks.sh
```

This script automatically runs:
- Ruff linting with auto-fix
- Black code formatting 
- Import sorting with isort
- Complete unit test suite (361 tests)
- Verification that all checks pass 100%

### Server Management

#### Start/Restart the Server
```bash
# Start or restart the Docker containers
./run-server.sh
```

This script will:
- Build/rebuild Docker images if needed
- Start the MCP server container (`zen-mcp-server`)
- Start the Redis container (`zen-mcp-redis`)
- Set up proper networking and volumes

#### Check Server Status
```bash
# Check if containers are running
docker ps

# Look for these containers:
# - zen-mcp-server
# - zen-mcp-redis
```

### Log Management

#### View Server Logs
```bash
# View last 500 lines of server logs
docker exec zen-mcp-server tail -n 500 /tmp/mcp_server.log

# Follow logs in real-time
docker exec zen-mcp-server tail -f /tmp/mcp_server.log

# View specific number of lines (replace 100 with desired count)
docker exec zen-mcp-server tail -n 100 /tmp/mcp_server.log

# Search logs for specific patterns
docker exec zen-mcp-server grep "ERROR" /tmp/mcp_server.log
docker exec zen-mcp-server grep "tool_name" /tmp/mcp_server.log
```

#### Monitor Tool Executions Only
```bash
# View tool activity log (focused on tool calls and completions)
docker exec zen-mcp-server tail -n 100 /tmp/mcp_activity.log

# Follow tool activity in real-time
docker exec zen-mcp-server tail -f /tmp/mcp_activity.log

# Use the dedicated log monitor (shows tool calls, completions, errors)
python log_monitor.py
```

The `log_monitor.py` script provides a real-time view of:
- Tool calls and completions
- Conversation resumptions and context
- Errors and warnings from all log files
- File rotation handling

#### All Available Log Files
```bash
# Main server log (all activity)
docker exec zen-mcp-server tail -f /tmp/mcp_server.log

# Tool activity only (TOOL_CALL, TOOL_COMPLETED, etc.)
docker exec zen-mcp-server tail -f /tmp/mcp_activity.log

# Debug information
docker exec zen-mcp-server tail -f /tmp/gemini_debug.log

# Overflow logs (when main log gets too large)
docker exec zen-mcp-server tail -f /tmp/mcp_server_overflow.log
```

#### Debug Container Issues
```bash
# Check container logs (Docker level)
docker logs zen-mcp-server

# Execute interactive shell in container
docker exec -it zen-mcp-server /bin/bash

# Check Redis container logs
docker logs zen-mcp-redis
```

### Testing

#### Run All Simulator Tests
```bash
# Run the complete test suite
python communication_simulator_test.py

# Run tests with verbose output
python communication_simulator_test.py --verbose

# Force rebuild environment before testing
python communication_simulator_test.py --rebuild
```

#### Run Individual Simulator Tests (Recommended)
```bash
# List all available tests
python communication_simulator_test.py --list-tests

# RECOMMENDED: Run tests individually for better isolation and debugging
python communication_simulator_test.py --individual basic_conversation
python communication_simulator_test.py --individual content_validation
python communication_simulator_test.py --individual cross_tool_continuation
python communication_simulator_test.py --individual logs_validation
python communication_simulator_test.py --individual redis_validation

# Run multiple specific tests (alternative approach)
python communication_simulator_test.py --tests basic_conversation content_validation

# Run individual test with verbose output for debugging
python communication_simulator_test.py --individual logs_validation --verbose

# Individual tests provide full Docker setup and teardown per test
# This ensures clean state and better error isolation
```

Available simulator tests include:
- `basic_conversation` - Basic conversation flow with chat tool
- `content_validation` - Content validation and duplicate detection
- `per_tool_deduplication` - File deduplication for individual tools
- `cross_tool_continuation` - Cross-tool conversation continuation scenarios
- `cross_tool_comprehensive` - Comprehensive cross-tool file deduplication and continuation
- `line_number_validation` - Line number handling validation across tools
- `logs_validation` - Docker logs validation
- `redis_validation` - Redis conversation memory validation
- `model_thinking_config` - Model-specific thinking configuration behavior
- `o3_model_selection` - O3 model selection and usage validation
- `ollama_custom_url` - Ollama custom URL endpoint functionality
- `openrouter_fallback` - OpenRouter fallback behavior when only provider
- `openrouter_models` - OpenRouter model functionality and alias mapping
- `token_allocation_validation` - Token allocation and conversation history validation
- `testgen_validation` - TestGen tool validation with specific test function
- `refactor_validation` - Refactor tool validation with codesmells
- `conversation_chain_validation` - Conversation chain and threading validation

**Note**: All simulator tests should be run individually for optimal testing and better error isolation.

#### Run Unit Tests Only
```bash
# Run all unit tests
python -m pytest tests/ -v

# Run specific test file
python -m pytest tests/test_refactor.py -v

# Run specific test function
python -m pytest tests/test_refactor.py::TestRefactorTool::test_format_response -v

# Run tests with coverage
python -m pytest tests/ --cov=. --cov-report=html
```

## Architecture Overview

**Zen/Zenode MCP Server** is a Model Context Protocol (MCP) server that orchestrates multiple AI models for enhanced code analysis and development workflows. The core architecture follows a modular provider-tool pattern:

### Core Components

1. **MCP Server Layer**: Handles JSON-RPC protocol communication with MCP clients
   - Python: `server.py` 
   - Node.js: `zenode/src/index.ts`
2. **Tool Registry**: Maps tool names to implementations - each tool provides specialized AI functionality
3. **Provider System**: Abstracts different AI model APIs (Gemini, OpenAI, OpenRouter, custom endpoints)
   - Python: `providers/`
   - Node.js: `zenode/src/providers/`
4. **Request Processing**: Routes tool calls to appropriate providers with context management
5. **Conversation Threading**: Uses Redis for persistent AI-to-AI conversations across tool calls

### Tool Architecture

Each tool follows a consistent pattern:
- **Base Tool**: Common functionality, model selection, conversation handling
  - Python: `tools/base.py`
  - Node.js: `zenode/src/tools/base.ts`
- **Specialized Tools**: 
  - `chat` - General development conversations
  - `thinkdeep` - Extended reasoning with thinking modes
  - `codereview` - Professional code review with severity levels
  - `precommit` - Git change validation across repositories
  - `debug` - Root cause analysis and debugging
  - `analyze` - General file/code analysis
  - `testgen` - Comprehensive test generation

### Provider System

- **Provider Registry**: Auto-discovery and model routing
  - Python: `providers/registry.py`
  - Node.js: `zenode/src/providers/registry.ts`
- **Base Provider**: Common interface for all AI providers
  - Python: `providers/base.py`
  - Node.js: `zenode/src/providers/base.ts`
- **Native Providers**: Direct API integration (Gemini, OpenAI)
- **OpenRouter Provider**: Multi-model access through single API
- **Custom Provider**: Support for local models (Ollama, vLLM, etc.)

### Key Features

- **Auto Mode**: Intelligent model selection based on task complexity
- **Conversation Threading**: Persistent context across multiple tool calls with Redis
- **Cross-Tool Continuation**: Continue conversations when switching between tools
- **Large Prompt Handling**: Automatic chunking and context management
- **Dynamic Token Allocation**: Adjusts context limits per model capabilities

### Configuration

- **Environment Variables**: API keys, model defaults, custom endpoints
- **Model Configs**: Custom model aliases and routing
  - Python: `conf/custom_models.json`
  - Node.js: `zenode/conf/custom_models.json`
- **Thinking Modes**: Token allocation for Gemini models (low/medium/high/max)

## Migration Planning Notes

### Current Node.js Architecture (Active Development)
- **Node.js 18+** minimum requirement (LTS version)
- **TypeScript** for type safety and better development experience
- **ESM Modules** preferred over CommonJS for modern Node.js
- **Docker workflow** with Node.js base image
- **npm** for dependency management
- **Jest** for testing framework
- **ESLint + Prettier** for code quality

### Python Architecture (Reference Only)
- **Python 3.9+** minimum requirement
- **Docker-first** development workflow
- **Redis** required for conversation threading
- **MCP Protocol**: Server communicates via stdio JSON-RPC messages
- **Async Architecture**: All providers and tools use async/await patterns

### Critical Migration Considerations
- **Preserve MCP Tool Signatures**: All tool inputs/outputs must remain identical
- **Maintain Provider Interfaces**: API call patterns and response handling
- **Keep Conversation Threading**: Redis-based conversation persistence
- **Docker Compatibility**: Ensure smooth deployment transition
- **Environment Configuration**: Same .env file structure and variables
- **Error Handling**: Maintain robust error responses for MCP clients

## Development Workflow

### Active Development (Node.js/Zenode)
1. Work in `zenode/` directory
2. Use Node.js/npm commands
3. Run `npm run dev` for development
4. Use `./run-server.sh` for Docker testing

### Reference Checking (Python)
1. Use Python commands for understanding original behavior
2. Run Python tests to understand expected outcomes
3. Compare implementations for feature parity
4. DO NOT modify Python code - it's reference only

### Environment Requirements

#### Node.js (Active)
- Node.js 20.x+ installed
- npm for package management
- Docker for containerized testing
- TypeScript for development

#### Python (Reference)
- Python 3.8+ with virtual environment activated
- Docker and Docker Compose installed
- All dependencies from `requirements.txt` installed
- Proper API keys configured in environment or config files

This guide provides everything needed to efficiently work with both the active Node.js Zenode implementation and reference Python Zen MCP Server codebase using Claude.