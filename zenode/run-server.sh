#!/bin/bash
# Zenode MCP Server - Docker runner script with Claude CLI integration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting Zenode MCP Server...${NC}"
echo ""

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running. Please start Docker.${NC}"
    exit 1
fi

# Use modern docker compose syntax if available, fall back to docker-compose
COMPOSE_CMD="docker compose"
if ! docker compose version &> /dev/null; then
    COMPOSE_CMD="docker-compose"
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        
        # Auto-detect and populate API keys from environment
        if [ -n "${GEMINI_API_KEY:-}" ]; then
            if command -v sed >/dev/null 2>&1; then
                sed -i.bak "s/your_gemini_api_key_here/$GEMINI_API_KEY/" .env && rm .env.bak
                echo -e "${GREEN}✅ Updated .env with GEMINI_API_KEY from environment${NC}"
            fi
        fi
        
        if [ -n "${OPENAI_API_KEY:-}" ]; then
            if command -v sed >/dev/null 2>&1; then
                sed -i.bak "s/your_openai_api_key_here/$OPENAI_API_KEY/" .env && rm .env.bak
                echo -e "${GREEN}✅ Updated .env with OPENAI_API_KEY from environment${NC}"
            fi
        fi
        
        if [ -n "${OPENROUTER_API_KEY:-}" ]; then
            if command -v sed >/dev/null 2>&1; then
                sed -i.bak "s/your_openrouter_api_key_here/$OPENROUTER_API_KEY/" .env && rm .env.bak
                echo -e "${GREEN}✅ Updated .env with OPENROUTER_API_KEY from environment${NC}"
            fi
        fi
        
        # Update MCP_WORKSPACE to use current user's home directory
        if command -v sed >/dev/null 2>&1; then
            sed -i.bak "s|/Users/edunc|$HOME|" .env && rm .env.bak
            echo -e "${GREEN}✅ Updated MCP_WORKSPACE to $HOME${NC}"
        fi
    else
        echo -e "${RED}❌ Error: .env.example not found. Cannot create .env file.${NC}"
        exit 1
    fi
fi

# Check if at least one API key is configured
source .env 2>/dev/null || true

HAS_VALID_KEY=false
if [[ -n "${GEMINI_API_KEY:-}" ]] && [[ "${GEMINI_API_KEY}" != "your_gemini_api_key_here" ]]; then
    HAS_VALID_KEY=true
    echo -e "${GREEN}✓ Gemini API key configured${NC}"
fi
if [[ -n "${OPENAI_API_KEY:-}" ]] && [[ "${OPENAI_API_KEY}" != "your_openai_api_key_here" ]]; then
    HAS_VALID_KEY=true
    echo -e "${GREEN}✓ OpenAI API key configured${NC}"
fi
if [[ -n "${OPENROUTER_API_KEY:-}" ]] && [[ "${OPENROUTER_API_KEY}" != "your_openrouter_api_key_here" ]]; then
    HAS_VALID_KEY=true
    echo -e "${GREEN}✓ OpenRouter API key configured${NC}"
fi
if [[ -n "${CUSTOM_API_URL:-}" ]] && [[ "${CUSTOM_API_URL}" != "http://localhost:11434" ]]; then
    HAS_VALID_KEY=true
    echo -e "${GREEN}✓ Custom API URL configured${NC}"
fi

if [ "$HAS_VALID_KEY" = false ]; then
    echo -e "${RED}❌ Error: No API keys configured in .env file.${NC}"
    echo ""
    echo "Please add at least one of the following to your .env file:"
    echo "  - GEMINI_API_KEY (get from https://makersuite.google.com/app/apikey)"
    echo "  - OPENAI_API_KEY (get from https://platform.openai.com/api-keys)"
    echo "  - OPENROUTER_API_KEY (get from https://openrouter.ai/keys)"
    echo "  - CUSTOM_API_URL (for local models)"
    echo ""
    exit 1
fi

# Set workspace directory
if [ -z "$MCP_WORKSPACE" ]; then
    # Default to zen-mcp-server project root for zenode self-analysis
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    export MCP_WORKSPACE="$PROJECT_ROOT"
    echo -e "${BLUE}ℹ️  MCP_WORKSPACE not set. Using project root for zenode self-analysis: $MCP_WORKSPACE${NC}"
    echo -e "${BLUE}    This allows zenode tools to analyze the zen-mcp-server codebase by default.${NC}"
    echo -e "${BLUE}    To use home directory instead, set: export MCP_WORKSPACE=\"$HOME\"${NC}"
fi

# Auto-detect project directory for mounting
detect_project_root() {
    local current_dir="$PWD"
    local indicators=(".git" "package.json" "Cargo.toml" "pyproject.toml" "go.mod" ".project")
    
    while [ "$current_dir" != "/" ]; do
        for indicator in "${indicators[@]}"; do
            if [ -e "$current_dir/$indicator" ]; then
                echo "$current_dir"
                return 0
            fi
        done
        current_dir=$(dirname "$current_dir")
    done
    return 1
}

PROJECT_ROOT=$(detect_project_root)
if [ -n "$PROJECT_ROOT" ] && [ "$PROJECT_ROOT" != "$PWD" ]; then
    echo -e "${GREEN}📁 Project detected: $PROJECT_ROOT${NC}"
    echo -e "${BLUE}ℹ️  Project will be mounted at /project inside container${NC}"
    export MCP_PROJECT_ROOT="$PROJECT_ROOT"
    export MCP_PROJECT_MOUNTED="true"
else
    echo -e "${BLUE}ℹ️  No project root detected or already in project directory${NC}"
fi

echo ""

# Build and start services
echo -e "${GREEN}🔨 Building Docker image...${NC}"
if ! $COMPOSE_CMD build; then
    echo -e "${RED}❌ Failed to build Docker image.${NC}"
    echo "Run '$COMPOSE_CMD build' manually to see detailed errors."
    exit 1
fi

echo -e "${GREEN}🚦 Starting services...${NC}"
if ! $COMPOSE_CMD up -d; then
    echo -e "${RED}❌ Failed to start services.${NC}"
    echo "Run '$COMPOSE_CMD up -d' manually to see detailed errors."
    exit 1
fi

# Wait for services to be ready
echo -e "${GREEN}⏳ Waiting for services to be ready...${NC}"
sleep 5

# Check service status
if $COMPOSE_CMD ps | grep -q "zenode-server.*Up.*healthy"; then
    echo -e "${GREEN}✅ Zenode MCP Server is running!${NC}"
    echo ""
    
    # Claude Code CLI Integration
    setup_claude_code_cli() {
        # Check if claude command exists
        if ! command -v claude &> /dev/null; then
            echo -e "${YELLOW}⚠️  Claude Code CLI not found. Install it to use Zenode with the CLI:${NC}"
            echo "   npm install -g @anthropic-ai/claude-code"
            echo ""
            echo "📋 After installing, run this command to add Zenode:"
            echo "   claude mcp add zenode -s user -- docker exec -i zenode-server node dist/index.js"
            return 1
        fi
        
        # Check if zenode is already configured in Claude CLI
        if claude mcp list 2>/dev/null | grep -q "zenode" 2>/dev/null; then
            echo -e "${GREEN}✅ Zenode already configured in Claude Code CLI${NC}"
            return 0
        else
            echo -e "${BLUE}🔧 Configuring Claude Code CLI...${NC}"
            echo ""
            echo -n "Would you like to add Zenode MCP Server to Claude Code CLI now? [Y/n]: "
            read -r response
            
            # Default to yes if empty response
            if [[ -z "$response" || "$response" =~ ^[Yy]$ ]]; then
                echo "  Adding Zenode MCP Server to Claude Code CLI..."
                if claude mcp add zenode -s user -- docker exec -i zenode-server node dist/index.js >/dev/null 2>&1; then
                    echo -e "${GREEN}✅ Zenode MCP Server added to Claude Code CLI successfully!${NC}"
                    echo "   Use 'claude' command to start a session with Zenode"
                else
                    echo -e "${YELLOW}⚠️  Failed to add MCP server automatically. Add it manually:${NC}"
                    echo "   claude mcp add zenode -s user -- docker exec -i zenode-server node dist/index.js"
                fi
            else
                echo "  Skipped. You can add it manually later:"
                echo "   claude mcp add zenode -s user -- docker exec -i zenode-server node dist/index.js"
            fi
            return 2
        fi
    }
    
    # Set up Claude Code CLI
    setup_claude_code_cli
    CLI_STATUS=$?
    
    echo ""
    echo "📊 Server details:"
    echo "  • Container: zenode-server"
    echo "  • Redis: localhost:6380"
    echo "  • Workspace: $MCP_WORKSPACE"
    echo ""
    echo "📝 Useful commands:"
    echo "  • View logs: docker logs zenode-server -f"
    echo "  • Stop server: $COMPOSE_CMD down"
    echo "  • Restart: $COMPOSE_CMD restart"
    echo ""
    
    # Show Claude Desktop configuration if needed
    if [ $CLI_STATUS -ne 0 ]; then
        echo "📋 For Claude Desktop, add this to your config:"
        echo "   Location:"
        echo "   • macOS: ~/Library/Application Support/Claude/claude_desktop_config.json"
        echo "   • Windows: %APPDATA%\\Claude\\claude_desktop_config.json"
        echo ""
        echo '   {
     "mcpServers": {
       "zenode": {
         "command": "docker",
         "args": ["exec", "-i", "zenode-server", "node", "dist/index.js"],
         "env": {
           "MCP_WORKSPACE": "'$MCP_WORKSPACE'"
         }
       }
     }
   }'
    fi
else
    echo -e "${RED}❌ Failed to start Zenode MCP Server${NC}"
    echo "Check logs for details: $COMPOSE_CMD logs"
    exit 1
fi