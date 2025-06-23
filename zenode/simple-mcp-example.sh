#!/bin/bash
# Simple MCP Server Quickstart Script
# Copy this file to simple-mcp.sh and add your API key

export REDIS_URL=redis://localhost:6380/0
export OPENROUTER_API_KEY=sk-or-v1-YOUR-OPENROUTER-KEY-HERE

# Optional: Add other API keys if you have them
# export OPENAI_API_KEY=sk-proj-YOUR-OPENAI-KEY-HERE
# export GEMINI_API_KEY=AIza-YOUR-GEMINI-KEY-HERE

# Start the zenode MCP server
echo "Starting Zenode MCP Server..."
echo "Redis URL: $REDIS_URL"
echo "API Keys configured: $([ -n "$OPENROUTER_API_KEY" ] && echo "✓" || echo "✗") OpenRouter"

# Run the server
node dist/index.js "$@"