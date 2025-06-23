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

## Development Practices

### Docker Image Build Best Practices

- Always use `--no-cache` with docker to force Docker to use the current `dist/` files. If the `dist` files look old, rebuild the TypeScript locally then rebuild the docker with `--no-cache`.

## Code Quality and Testing

[Rest of the file remains the same as in the previous content]