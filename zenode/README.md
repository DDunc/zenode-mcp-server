# Zenode MCP Server

A high-performance Node.js implementation of the Model Context Protocol (MCP) server that orchestrates multiple AI models for enhanced code analysis and development workflows.

## Features

- **7 Specialized AI Tools**: Chat, deep thinking, code review, pre-commit validation, debugging, analysis, and test generation
- **Multi-Provider Support**: Seamlessly work with Google Gemini, OpenAI, OpenRouter, and custom endpoints
- **Conversation Threading**: Maintain context across multiple tool calls with Redis-based persistence
- **Extended Thinking Modes**: Allocate computational resources based on task complexity
- **MCP Protocol Compliant**: Works with any MCP-compatible client (Claude Desktop, IDEs, etc.)
- **Docker-First Deployment**: Production-ready containerization with health monitoring

## Requirements

### System Requirements
- Node.js 20.x LTS or higher
- npm 10.x or higher
- Redis 7.0 or higher (for conversation threading)
- Docker & Docker Compose (for containerized deployment)

### API Keys
At least one of the following API configurations is required:
- Google Gemini API key
- OpenAI API key
- OpenRouter API key
- Custom API endpoint (for local models like Ollama)

## Installation

### Option 1: Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/zen-mcp-server.git
cd zen-mcp-server/zenode
```

2. Copy the environment template:
```bash
cp .env.example .env
```

3. Edit `.env` and add your API keys:
```bash
# At least one of these is required
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Optional: Custom endpoint for local models
CUSTOM_API_URL=http://localhost:11434
CUSTOM_API_KEY=optional_key_if_required
CUSTOM_MODEL_NAME=llama3.2
```

4. Start the server:
```bash
docker-compose up -d
```

### Option 2: Local Development

1. Clone and install dependencies:
```bash
git clone https://github.com/yourusername/zen-mcp-server.git
cd zen-mcp-server/zenode
npm install
```

2. Set up environment variables (same as Docker option)

3. Start Redis:
```bash
docker run -d -p 6379:6379 redis:7-alpine
```

4. Build and run:
```bash
npm run build
npm start
```

For development with hot reload:
```bash
npm run dev
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GEMINI_API_KEY` | Google Gemini API key | One of these | - |
| `OPENAI_API_KEY` | OpenAI API key | is required | - |
| `OPENROUTER_API_KEY` | OpenRouter API key | | - |
| `CUSTOM_API_URL` | Custom model endpoint | | - |
| `CUSTOM_API_KEY` | Custom endpoint API key | No | - |
| `CUSTOM_MODEL_NAME` | Default custom model | No | llama3.2 |
| `DEFAULT_MODEL` | Default model selection | No | auto |
| `REDIS_URL` | Redis connection URL | No | redis://localhost:6379 |
| `LOG_LEVEL` | Logging level | No | INFO |
| `MCP_WORKSPACE` | Workspace directory path | No | /home/user |

### Model Configuration

Models can be configured via `conf/custom_models.json`:

```json
{
  "model_aliases": {
    "opus": "anthropic/claude-3-opus-20240229",
    "sonnet": "anthropic/claude-3.5-sonnet-latest",
    "pro": "gemini-2.0-pro-exp",
    "flash": "gemini-2.5-flash-latest"
  }
}
```

### Provider Priority

When multiple providers are configured, the system selects models in this order:
1. Native APIs (Gemini, OpenAI) - Most efficient
2. Custom endpoints - For local/private models
3. OpenRouter - Catch-all for other models

## Usage

### With Claude Desktop

1. Open Claude Desktop configuration file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the Zenode server configuration:

```json
{
  "mcpServers": {
    "zenode": {
      "command": "node",
      "args": ["/path/to/zen-mcp-server/zenode/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your_key_here",
        "MCP_WORKSPACE": "/path/to/your/workspace"
      }
    }
  }
}
```

3. Restart Claude Desktop to load the new configuration

4. Use tools with @-mentions: `@zenode.chat "Hello!"`

**Note**: Zenode and the original Zen server can coexist. See [CLAUDE-INTEGRATION.md](CLAUDE-INTEGRATION.md) for detailed setup instructions.

### Available Tools

#### 1. Chat
General development conversations and brainstorming
```
@zenode.chat "How should I structure my authentication system?"
```

#### 2. ThinkDeep
Extended reasoning for complex problems with configurable thinking modes
```
@zenode.thinkdeep "Analyze the performance implications of this architecture"
```

#### 3. CodeReview
Professional code review with severity levels
```
@zenode.codereview "Review my authentication implementation for security issues"
```

#### 4. Precommit
Validate git changes before committing
```
@zenode.precommit "Check my changes match the requirements"
```

#### 5. Debug
Root cause analysis and debugging assistance
```
@zenode.debug "Why is this API call failing intermittently?"
```

#### 6. Analyze
General file and code analysis
```
@zenode.analyze "What does this legacy module do?"
```

#### 7. TestGen
Comprehensive test generation with edge cases
```
@zenode.testgen "Generate tests for the User authentication module"
```

### Thinking Modes

For tools that support extended thinking (thinkdeep, debug, codereview):
- `minimal`: Quick analysis (0.5% of model's max thinking capacity)
- `low`: Light analysis (8%)
- `medium`: Standard analysis (33%)
- `high`: Deep analysis (67%)
- `max`: Maximum analysis (100%)

### Conversation Threading

Continue conversations across tool calls:
```
@zenode.thinkdeep "Analyze this architecture"
# Returns continuation_id: abc123

@zenode.codereview "Review the implementation" --continuation abc123
# Continues with previous context
```

## Development

### Project Structure
```
zenode-mcp-server/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── config.ts         # Configuration management
│   ├── providers/        # AI provider implementations
│   ├── tools/           # MCP tool implementations
│   └── utils/           # Utility functions
├── tests/               # Test suites
├── systemprompts/       # AI prompt templates
└── conf/               # Configuration files
```

### Running Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Code Quality
```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run type-check
```

### Building
```bash
# Build for production
npm run build

# Clean build artifacts
npm run clean
```

## Deployment

### Production Docker Build

```bash
# Build production image
docker build -t zenode-mcp-server:latest .

# Run with environment file
docker run -d \
  --name zenode-server \
  --env-file .env \
  -v /path/to/workspace:/workspace \
  zenode-mcp-server:latest
```

### Docker Compose Production

```yaml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data

  zenode:
    image: zenode-mcp-server:latest
    restart: unless-stopped
    env_file: .env
    depends_on:
      - redis
    environment:
      - REDIS_URL=redis://redis:6379
    volumes:
      - /path/to/workspace:/workspace:ro

volumes:
  redis-data:
```

### Health Monitoring

The server includes health check endpoints:
- Liveness: Server is running
- Readiness: Server can handle requests

Monitor logs:
```bash
docker logs zenode-server -f
```

## Troubleshooting

### Common Issues

1. **No API keys configured**
   - Ensure at least one valid API key is set in environment variables
   - Check that placeholder values are replaced with actual keys

2. **Redis connection failed**
   - Verify Redis is running: `docker ps | grep redis`
   - Check Redis URL in environment variables
   - Ensure Redis port (6379) is not blocked

3. **Model not available**
   - Check provider configuration and API key validity
   - Verify model name in custom_models.json
   - Review model restrictions if configured

4. **High memory usage**
   - Adjust Node.js heap size: `NODE_OPTIONS="--max-old-space-size=4096"`
   - Configure token limits for large contexts
   - Monitor with: `docker stats zenode-server`

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=DEBUG npm run dev
```

View detailed MCP communication:
```bash
tail -f /tmp/mcp_server.log
tail -f /tmp/mcp_activity.log
```

## Security

- API keys are never logged or exposed
- File operations restricted to workspace directory
- Input validation on all tool parameters
- Secure defaults for all configurations

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make changes and add tests
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- Issues: [GitHub Issues](https://github.com/yourusername/zenode-mcp-server/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/zenode-mcp-server/discussions)
- Documentation: [Wiki](https://github.com/yourusername/zenode-mcp-server/wiki)

## Acknowledgments

This is a Node.js implementation of the original Python-based Zen MCP Server, maintaining full compatibility while leveraging the Node.js ecosystem.