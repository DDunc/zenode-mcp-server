#!/bin/bash
# Zenode Status Check Script
# Quick status overview of zenode MCP server

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔍 Zenode MCP Server Status${NC}"
echo "============================="

# Docker containers
echo -e "\n${BLUE}📦 Container Status:${NC}"
docker-compose ps

# Test CLI mode
echo -e "\n${BLUE}⚡ CLI Mode Test:${NC}"
if docker exec zenode-server node dist/index.js version | grep -q "Available Tools"; then
    echo -e "${GREEN}✅ CLI mode working${NC}"
else
    echo -e "${RED}❌ CLI mode failed${NC}"
fi

# Test MCP protocol
echo -e "\n${BLUE}🔗 MCP Protocol Test:${NC}"
if echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | docker exec -i zenode-server node dist/index.js | grep -q '"planner"'; then
    echo -e "${GREEN}✅ MCP protocol working - planner tool available${NC}"
else
    echo -e "${RED}❌ MCP protocol failed${NC}"
fi

# Test planner tool specifically
echo -e "\n${BLUE}🎯 Planner Tool Test:${NC}"
if docker exec zenode-server node dist/index.js planner '{"step":"test","step_number":1,"total_steps":1,"next_step_required":false}' | grep -q "Test" 2>/dev/null; then
    echo -e "${GREEN}✅ Planner tool working${NC}"
else
    echo -e "${YELLOW}⚠️  Planner tool may need manual testing${NC}"
fi

# API Keys
echo -e "\n${BLUE}🔑 API Configuration:${NC}"
if [ -f .env ]; then
    source .env
    if [[ -n "${OPENROUTER_API_KEY:-}" ]] && [[ "${OPENROUTER_API_KEY}" != "your_openrouter_api_key_here" ]]; then
        echo -e "${GREEN}✅ OpenRouter API key configured${NC}"
    fi
    if [[ -n "${OPENAI_API_KEY:-}" ]] && [[ "${OPENAI_API_KEY}" != "your_openai_api_key_here" ]]; then
        echo -e "${GREEN}✅ OpenAI API key configured${NC}"
    fi
    if [[ -n "${GEMINI_API_KEY:-}" ]] && [[ "${GEMINI_API_KEY}" != "your_gemini_api_key_here" ]]; then
        echo -e "${GREEN}✅ Gemini API key configured${NC}"
    fi
else
    echo -e "${RED}❌ No .env file found${NC}"
fi

# Claude Code registration
echo -e "\n${BLUE}🎨 Claude Code Integration:${NC}"
if command -v claude &> /dev/null; then
    if claude mcp list 2>/dev/null | grep -q "zenode"; then
        echo -e "${GREEN}✅ Registered with Claude Code CLI${NC}"
    else
        echo -e "${YELLOW}⚠️  Not registered with Claude Code CLI${NC}"
    fi
else
    echo -e "${BLUE}ℹ️  Claude Code CLI not installed${NC}"
fi

# Check Claude Desktop
config_paths=(
    "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    "$HOME/.config/Claude/claude_desktop_config.json"
)

claude_desktop_found=false
for config_path in "${config_paths[@]}"; do
    if [ -f "$config_path" ]; then
        claude_desktop_found=true
        if grep -q "zenode" "$config_path" 2>/dev/null; then
            echo -e "${GREEN}✅ Registered with Claude Desktop${NC}"
        else
            echo -e "${YELLOW}⚠️  Not registered with Claude Desktop${NC}"
        fi
        break
    fi
done

if [ "$claude_desktop_found" = false ]; then
    echo -e "${BLUE}ℹ️  Claude Desktop config not found${NC}"
fi

echo -e "\n${BLUE}💡 Next Steps:${NC}"
echo "• Test :z trigger in Claude Code: ':z test planner functionality'"
echo "• Run auto-repair if issues: ./zenode-auto-repair.sh"
echo "• View logs: docker logs zenode-server"
echo ""