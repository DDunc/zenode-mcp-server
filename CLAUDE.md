# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Context

**MIGRATION GOAL**: Convert this entire Python-based Zen MCP Server to Node.js while maintaining all functionality and architecture patterns.

**DEVELOPER CONTEXT**: The developer working on this project is a Python novice with strong JavaScript/TypeScript/Node.js/bash experience. When working with the existing Python code, explain Python concepts, ecosystem, toolchain, and syntax as if teaching someone who understands JS/TS/Node.js but is new to Python.

This is currently a Python MCP server that orchestrates multiple AI models. The goal is to rewrite it in Node.js/TypeScript while preserving:
- All 7 AI tools (chat, thinkdeep, codereview, precommit, debug, analyze, testgen)
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

## Current Python Development Commands

### Testing
- **Run all tests**: `pytest`
- **Run specific test file**: `pytest tests/test_filename.py`
- **Run with verbose output**: `pytest -v`
- **Run specific test function**: `pytest tests/test_filename.py::test_function_name`

### Code Quality
- **Format code (Black)**: `black .` (line length: 120 chars)
- **Sort imports (isort)**: `isort .`
- **Lint code (Ruff)**: `ruff check .`
- **Fix linting issues**: `ruff check . --fix`

### Docker Development
- **Build and start server**: `./run-server.sh`
- **View server logs**: `docker logs zen-mcp-server -f`
- **Stop services**: `docker compose down`
- **Rebuild after changes**: `./run-server.sh` (automatically rebuilds)

### Local Development
- **Install dependencies**: `pip install -r requirements.txt`
- **Run server directly**: `python server.py`

## Architecture Overview

**Zen MCP Server** is a Model Context Protocol (MCP) server that orchestrates multiple AI models for enhanced code analysis and development workflows. The core architecture follows a modular provider-tool pattern:

### Core Components

1. **MCP Server Layer** (`server.py`): Handles JSON-RPC protocol communication with MCP clients
2. **Tool Registry**: Maps tool names to implementations - each tool provides specialized AI functionality
3. **Provider System** (`providers/`): Abstracts different AI model APIs (Gemini, OpenAI, OpenRouter, custom endpoints)
4. **Request Processing**: Routes tool calls to appropriate providers with context management
5. **Conversation Threading**: Uses Redis for persistent AI-to-AI conversations across tool calls

### Tool Architecture (`tools/`)

Each tool follows a consistent pattern:
- **Base Tool** (`tools/base.py`): Common functionality, model selection, conversation handling
- **Specialized Tools**: 
  - `chat.py` - General development conversations
  - `thinkdeep.py` - Extended reasoning with thinking modes
  - `codereview.py` - Professional code review with severity levels
  - `precommit.py` - Git change validation across repositories
  - `debug.py` - Root cause analysis and debugging
  - `analyze.py` - General file/code analysis
  - `testgen.py` - Comprehensive test generation

### Provider System (`providers/`)

- **Provider Registry** (`registry.py`): Auto-discovery and model routing
- **Base Provider** (`base.py`): Common interface for all AI providers
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
- **Model Configs** (`conf/custom_models.json`): Custom model aliases and routing
- **Thinking Modes**: Token allocation for Gemini models (low/medium/high/max)

## Migration Planning Notes

### Current Python Architecture (To Be Migrated)
- **Python 3.9+** minimum requirement
- **Docker-first** development workflow (will be preserved)
- **Redis** required for conversation threading (will remain)
- **MCP Protocol**: Server communicates via stdio JSON-RPC messages (same in Node.js)
- **Async Architecture**: All providers and tools use async/await patterns (same in Node.js)

### Target Node.js Architecture
- **Node.js 18+** minimum requirement (LTS version)
- **TypeScript** for type safety and better development experience
- **ESM Modules** preferred over CommonJS for modern Node.js
- **Same Docker workflow** with Node.js base image
- **npm/yarn** for dependency management
- **Jest/Vitest** for testing framework
- **ESLint + Prettier** for code quality (equivalent to black/ruff)

### Critical Migration Considerations
- **Preserve MCP Tool Signatures**: All tool inputs/outputs must remain identical
- **Maintain Provider Interfaces**: API call patterns and response handling
- **Keep Conversation Threading**: Redis-based conversation persistence
- **Docker Compatibility**: Ensure smooth deployment transition
- **Environment Configuration**: Same .env file structure and variables
- **Error Handling**: Maintain robust error responses for MCP clients