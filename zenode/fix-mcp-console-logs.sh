#!/bin/bash

# Fix MCP Console Log Issues
# This script removes console.log statements that break MCP protocol

echo "🔧 Fixing MCP console.log issues..."

# Remove console.log debug statements from compiled config.js
sed -i.backup "/console\.log('🔍 Config Environment Debug:')/,+2d" dist/config.js

# Also check for any other console.log statements in dist that might interfere
echo "📋 Checking for remaining console.log statements in dist..."
grep -n "console\.log" dist/*.js | grep -v "CLI Mode" | grep -v "CLI Error" || echo "✅ No problematic console.log statements found"

echo "🔄 Restarting Docker containers..."
docker-compose restart zenode

echo "✅ MCP console.log fix complete!"
echo ""
echo "Next steps:"
echo "1. Restart Claude Desktop to reconnect to the fixed MCP server"
echo "2. Test with: zenode:chat \"Hello world\""