# Zenode MCP Server - Quick Start Guide

## 1. Prerequisites

- Node.js 20+ installed
- Redis running (for conversation threading)
- At least one AI API key (Gemini, OpenAI, OpenRouter, or Custom)

## 2. Installation

```bash
# Clone the repo (if not already done)
git clone https://github.com/yourusername/zen-mcp-server.git
cd zen-mcp-server/zenode

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

## 3. Build and Run

### Option A: Direct Node.js
```bash
# Build TypeScript
npm run build

# Run the server
npm start
```

### Option B: Docker
```bash
# Build and run with Docker
./run-server.sh
```

### Option C: Development Mode
```bash
# Run with hot reload
npm run dev
```

## 4. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zenode": {
      "command": "node",
      "args": ["/absolute/path/to/zen-mcp-server/node-js/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## 5. Test in Claude

After restarting Claude Desktop:

```
@zenode.chat "Hello, are you working?"
```

## Managing Multiple MCP Servers

### Both Zen and Zenode Active:
```json
{
  "mcpServers": {
    "zen": {
      // Original Python Zen config
    },
    "zenode": {
      // Node.js Zenode config
    }
  }
}
```

### Switch Between Servers:
```json
{
  "mcpServers": {
    // "zen": { ... },     // Commented out to disable
    "zenode": { ... }      // Active
  }
}
```

### Disable a Server:
Simply remove or comment out its configuration block.

## Common Issues

### "Server not found" in Claude
- Restart Claude Desktop after config changes
- Check JSON syntax in config file
- Verify absolute paths are correct

### "API key not configured"
- Ensure .env file exists and has valid keys
- Check environment variables in Claude config

### "Cannot connect to Redis"
- Start Redis: `docker run -d -p 6379:6379 redis:7-alpine`
- Or disable threading by not using continuation_id

## Environment Variables

Minimum required:
```bash
# At least one of these:
GEMINI_API_KEY=your_key
OPENAI_API_KEY=your_key
OPENROUTER_API_KEY=your_key
CUSTOM_API_URL=http://localhost:11434
```

Optional:
```bash
DEFAULT_MODEL=auto          # or specific model name
REDIS_URL=redis://localhost:6379/0
LOG_LEVEL=INFO             # DEBUG for troubleshooting
MCP_WORKSPACE=/path/to/workspace
```

## Available Tools (Currently Implemented)

- `@zenode.chat` - General conversation and assistance
- `@zenode.version` - Check server version and configuration

## Logs Location

- **Server logs**: `/tmp/zenode_mcp_server-*.log`
- **Activity logs**: `/tmp/zenode_mcp_activity-*.log`
- **Docker logs**: `docker logs zenode-server`

## Quick Commands

```bash
# Check if server is running
ps aux | grep zenode

# View server logs
tail -f /tmp/zenode_mcp_server-*.log

# Test server manually
GEMINI_API_KEY=your-key node dist/index.js

# Validate Claude config
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
```