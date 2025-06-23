#!/bin/bash

echo "🧪 Testing error propagation in zenode MCP server..."

# Test 1: Call a tool with invalid parameters to trigger an error
echo "📝 Test 1: Invalid tool parameters"
echo '{"jsonrpc":"2.0","method":"tools/call","id":1,"params":{"name":"chat","arguments":{}}}' | \
  docker exec -i zenode-mcp node dist/index.js 2>&1 | \
  grep -E "(error|Error)" || echo "❌ No error captured in output"

# Test 2: Check Docker logs for the error
echo ""
echo "📝 Test 2: Check Docker logs for errors"
docker-compose logs zenode --tail=20 2>&1 | grep -i error | tail -5

# Test 3: Check error log file in container
echo ""
echo "📝 Test 3: Check error log files"
docker exec zenode-mcp sh -c "ls -la /tmp/zenode_mcp_server_error*.log 2>/dev/null || echo 'No error log files found'"

# Test 4: Trigger a non-existent tool error
echo ""
echo "📝 Test 4: Non-existent tool error"
echo '{"jsonrpc":"2.0","method":"tools/call","id":2,"params":{"name":"nonexistent","arguments":{}}}' | \
  docker exec -i zenode-mcp node dist/index.js 2>&1 | \
  grep -E "(error|Error|MethodNotFound)" || echo "❌ No error captured"

echo ""
echo "✅ Error propagation test complete"