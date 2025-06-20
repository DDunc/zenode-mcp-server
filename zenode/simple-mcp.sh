#!/bin/bash
export REDIS_URL=redis://localhost:6380/0
export OPENROUTER_API_KEY=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
cd /Users/edunc/Documents/gitz/zen-mcp-server/zenode
node dist/index.js