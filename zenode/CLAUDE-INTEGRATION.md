# Connecting Zenode to Claude Desktop

## Overview

Both Zen (Python) and Zenode (Node.js) are MCP servers that can be used with Claude Desktop. They can coexist without conflicts as long as they're configured with different names in Claude's settings.

## How MCP Servers Work with Claude

MCP servers communicate with Claude Desktop through stdio (standard input/output). When Claude needs to use a tool, it:
1. Starts the MCP server process
2. Sends JSON-RPC messages via stdin
3. Receives responses via stdout
4. Shuts down the server when done

Each server is identified by a unique name in Claude's configuration.

## Configuring Zenode with Claude Desktop

### 1. Locate Claude Desktop Configuration

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### 2. Add Zenode Configuration

Edit the configuration file to add Zenode:

```json
{
  "mcpServers": {
    "zenode": {
      "command": "node",
      "args": ["/path/to/zen-mcp-server/zenode/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-key",
        "OPENAI_API_KEY": "your-openai-key",
        "REDIS_URL": "redis://localhost:6379",
        "MCP_WORKSPACE": "/path/to/your/workspace"
      }
    }
  }
}
```

**Alternative: Using Docker:**
```json
{
  "mcpServers": {
    "zenode": {
      "command": "docker",
      "args": [
        "run", 
        "-i", 
        "--rm",
        "--network", "host",
        "-v", "/path/to/workspace:/workspace:ro",
        "zenode-mcp-server:latest"
      ],
      "env": {
        "GEMINI_API_KEY": "your-gemini-key",
        "OPENAI_API_KEY": "your-openai-key"
      }
    }
  }
}
```

**Alternative: Using npx (if published):**
```json
{
  "mcpServers": {
    "zenode": {
      "command": "npx",
      "args": ["zenode-mcp-server"],
      "env": {
        "GEMINI_API_KEY": "your-gemini-key"
      }
    }
  }
}
```

## Running Both Zen and Zenode Together

You can have both servers configured simultaneously without conflicts:

```json
{
  "mcpServers": {
    "zen": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--network", "host",
        "-v", "/path/to/workspace:/home/user/zen_workspace:ro",
        "-e", "MCP_WORKSPACE=/home/user/zen_workspace",
        "ghcr.io/beehiveinnovations/zen-mcp-server:latest"
      ],
      "env": {
        "GEMINI_API_KEY": "your-key"
      }
    },
    "zenode": {
      "command": "node",
      "args": ["/path/to/zen-mcp-server/zenode/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-key",
        "MCP_WORKSPACE": "/path/to/workspace"
      }
    }
  }
}
```

## Enabling/Disabling Servers

### Method 1: Comment Out Configuration
To disable a server temporarily, comment it out:

```json
{
  "mcpServers": {
    // "zen": { ... },  // Disabled
    "zenode": { 
      // Active configuration
    }
  }
}
```

### Method 2: Use Different Config Files
Create multiple config files and switch between them:

```bash
# Backup current config
cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/claude_config_both.json

# Create Zenode-only config
cp ~/claude_config_zenode_only.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### Method 3: Rename Server Keys
Temporarily rename servers to disable them:

```json
{
  "mcpServers": {
    "zen-disabled": { /* zen config */ },
    "zenode": { /* zenode config */ }
  }
}
```

## Using the Servers in Claude

Once configured, you can use the tools with @-mentions:

**For Zenode:**
```
@zenode.chat "How do I implement authentication?"
@zenode.codereview "Review my login implementation"
@zenode.debug "Why is my API failing?"
```

**For Zen (if also configured):**
```
@zen.chat "Explain this Python code"
@zen.thinkdeep "Analyze this architecture"
```

## Troubleshooting

### 1. Server Not Appearing in Claude
- Restart Claude Desktop after editing configuration
- Check that the configuration JSON is valid
- Ensure the server path is correct

### 2. Server Fails to Start
- Check logs: `~/Library/Logs/Claude/mcp-*.log` (macOS)
- Verify all required environment variables are set
- Test the server command manually in terminal

### 3. Tool Calls Fail
- Ensure API keys are valid
- Check that Redis is running (for conversation threading)
- Verify workspace path exists and is readable

### 4. Port Conflicts
If running both servers locally:
- Zen uses its own Redis instance in Docker
- Zenode can use a different Redis database: `REDIS_URL=redis://localhost:6379/1`

## Development Setup

For development, you might want to run Zenode directly:

```json
{
  "mcpServers": {
    "zenode-dev": {
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "/path/to/zenode-mcp-server/node-js",
      "env": {
        "GEMINI_API_KEY": "your-key",
        "LOG_LEVEL": "DEBUG"
      }
    }
  }
}
```

## Best Practices

1. **Use Different Names**: Always use different names for each server (zen, zenode, etc.)
2. **Separate Workspaces**: Consider using different workspace paths for each server
3. **Monitor Resources**: Both servers running together will use more memory
4. **Choose One for Production**: For daily use, pick the server that best meets your needs

## Quick Commands

**Check which servers are configured:**
```bash
# macOS
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq '.mcpServers | keys'
```

**Validate configuration:**
```bash
# macOS
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
```

**Test Zenode manually:**
```bash
cd /path/to/zenode-mcp-server/node-js
npm run build
GEMINI_API_KEY=your-key node dist/index.js
# Should see: "Listening for MCP requests on stdio..."
```