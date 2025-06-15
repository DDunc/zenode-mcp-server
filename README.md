# Zenode MCP: Node.js Port of Zen MCP Server

**Node.js/TypeScript implementation of the powerful Zen MCP Server**

This is the Node.js port of the original (very actively developed, awesome) Python [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server). The zenode implementation provides the same powerful AI orchestration capabilities with the performance and ecosystem benefits of Node.js.

## Quick Start

```bash
cd zenode
npm install
cp .env.example .env
# Edit .env with your API keys
npm run dev
```

## Documentation

- **[Zenode Documentation](./zenode/README.md)** - Complete Node.js implementation guide
- **[Python Original](./ZEN-MCP-PYTHON-README.md)** - Original Python implementation (reference)
- **[Development Guide](./CLAUDE.md)** - Development instructions for both implementations

## Key Features

- **Node.js/TypeScript**: Modern async architecture
- **All AI Tools**: chat, thinkdeep, codereview, precommit, debug, analyze, testgen, gopher
- **Multi-Provider**: Gemini, OpenAI, OpenRouter, custom endpoints
- **Conversation Threading**: Redis-based persistence
- **Docker Ready**: Production deployment
- **MCP Compliant**: Works with Claude Code and Claude Desktop

## Migration Status

✅ **Core Server**: MCP protocol, tool registry, provider system  
✅ **AI Providers**: Gemini, OpenAI, OpenRouter, Custom APIs  
✅ **Tools**: All 8 tools fully implemented  
✅ **Conversation Threading**: Redis persistence  
✅ **Docker**: Full containerization  
✅ **Testing**: Jest test suite  

## Architecture

```
zenode/
├── src/
│   ├── index.ts          # Main MCP server
│   ├── providers/        # AI provider implementations  
│   ├── tools/           # MCP tool implementations
│   ├── middleware/      # Request pipeline & logging
│   └── utils/           # Utilities and helpers
├── tests/               # Jest test suites
└── docker-compose.yml   # Production deployment
```

## Development

**Active development** happens in the `zenode/` directory. The Python code serves as a reference for feature parity.

### Node.js Development
```bash
cd zenode
npm install
npm run dev        # Development with hot reload
npm test          # Run test suite
npm run lint      # Code quality checks
./run-server.sh   # Docker deployment
```

### Python Reference
```bash
# For understanding original behavior only
./run-server.sh    # Start Python server
python -m pytest  # Run Python tests
```

## Configuration

Both implementations use the same `.env` configuration:

```env
# At least one API key required
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here  
OPENROUTER_API_KEY=your_key_here

# Redis for conversation threading
REDIS_URL=redis://localhost:6379

# Optional: Custom endpoints (Ollama, vLLM, etc.)
CUSTOM_API_URL=http://localhost:11434
```

## Tools Overview

### Available Tools
1. **chat** - Collaborative thinking and brainstorming
2. **thinkdeep** - Extended reasoning with thinking modes  
3. **codereview** - Professional code review with severity levels
4. **precommit** - Git change validation across repositories
5. **debug** - Root cause analysis and debugging
6. **analyze** - File and code analysis
7. **testgen** - Comprehensive test generation
8. **gopher** - Local file access bridge

### Usage Examples
```
# Use specific model
"Use flash to analyze this code quickly"
"Get o3 to debug this complex logic error"

# Auto mode (recommended)  
"Review this code for security issues"
"Generate tests for the auth module"
```

## License

Apache 2.0 License - see LICENSE file for details.

## Acknowledgments

- Original Python [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server) by BeehiveInnovations
- [MCP (Model Context Protocol)](https://modelcontextprotocol.com) by Anthropic
- [Claude Code](https://claude.ai/code) - AI coding assistant integration