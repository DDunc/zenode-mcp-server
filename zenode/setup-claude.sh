#!/bin/bash
# Setup script to configure Zenode in Claude Desktop

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect OS and set config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_PATH="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    CONFIG_PATH="$APPDATA/Claude/claude_desktop_config.json"
else
    CONFIG_PATH="$HOME/.config/Claude/claude_desktop_config.json"
fi

echo -e "${BLUE}Zenode MCP Server - Claude Desktop Setup${NC}"
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo -e "${YELLOW}Claude config file not found at: $CONFIG_PATH${NC}"
    echo "Creating new configuration..."
    mkdir -p "$(dirname "$CONFIG_PATH")"
    echo '{"mcpServers":{}}' > "$CONFIG_PATH"
fi

# Backup current config
BACKUP_PATH="${CONFIG_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$CONFIG_PATH" "$BACKUP_PATH"
echo -e "${GREEN}✓ Backed up current config to: $BACKUP_PATH${NC}"

# Get current directory
ZENODE_PATH="$(cd "$(dirname "$0")" && pwd)"

# Check if .env exists
if [ ! -f "$ZENODE_PATH/.env" ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create .env from .env.example and add your API keys"
    exit 1
fi

# Read API keys from .env (basic parsing)
GEMINI_KEY=$(grep "^GEMINI_API_KEY=" "$ZENODE_PATH/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
OPENAI_KEY=$(grep "^OPENAI_API_KEY=" "$ZENODE_PATH/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
OPENROUTER_KEY=$(grep "^OPENROUTER_API_KEY=" "$ZENODE_PATH/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'")
REDIS_URL=$(grep "^REDIS_URL=" "$ZENODE_PATH/.env" | cut -d'=' -f2 | tr -d '"' | tr -d "'")

# Check if at least one API key is configured
if [[ -z "$GEMINI_KEY" ]] && [[ -z "$OPENAI_KEY" ]] && [[ -z "$OPENROUTER_KEY" ]]; then
    echo -e "${RED}Error: No API keys found in .env file${NC}"
    exit 1
fi

# Build the server first
echo -e "${YELLOW}Building Zenode server...${NC}"
cd "$ZENODE_PATH"
npm run build

# Create new config with Zen disabled and Zenode enabled
echo -e "${YELLOW}Updating Claude configuration...${NC}"

# Use Node.js to properly handle JSON
node -e "
const fs = require('fs');
const path = require('path');

const configPath = '$CONFIG_PATH';
const zenodePath = '$ZENODE_PATH';

// Read current config
let config = {};
try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
    config = { mcpServers: {} };
}

// Ensure mcpServers exists
if (!config.mcpServers) {
    config.mcpServers = {};
}

// Comment out Zen by renaming it
if (config.mcpServers.zen) {
    config.mcpServers['zen-disabled'] = config.mcpServers.zen;
    delete config.mcpServers.zen;
    console.log('✓ Disabled Zen MCP server');
}

// Configure Zenode
config.mcpServers.zenode = {
    command: 'node',
    args: [path.join(zenodePath, 'dist', 'index.js')],
    env: {}
};

// Add API keys if available
if ('$GEMINI_KEY' && '$GEMINI_KEY' !== 'your_gemini_api_key_here') {
    config.mcpServers.zenode.env.GEMINI_API_KEY = '$GEMINI_KEY';
}
if ('$OPENAI_KEY' && '$OPENAI_KEY' !== 'your_openai_api_key_here') {
    config.mcpServers.zenode.env.OPENAI_API_KEY = '$OPENAI_KEY';
}
if ('$OPENROUTER_KEY' && '$OPENROUTER_KEY' !== 'your_openrouter_api_key_here') {
    config.mcpServers.zenode.env.OPENROUTER_API_KEY = '$OPENROUTER_KEY';
}
if ('$REDIS_URL') {
    config.mcpServers.zenode.env.REDIS_URL = '$REDIS_URL';
}

// Set workspace to current directory by default
config.mcpServers.zenode.env.MCP_WORKSPACE = process.env.MCP_WORKSPACE || process.cwd();

// Write updated config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log('✓ Enabled Zenode MCP server');
"

echo ""
echo -e "${GREEN}✅ Configuration complete!${NC}"
echo ""
echo -e "${BLUE}What was done:${NC}"
echo "  • Backed up your config to: $BACKUP_PATH"
echo "  • Disabled Zen server (renamed to 'zen-disabled')"
echo "  • Enabled Zenode server at: $ZENODE_PATH"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Restart Claude Desktop"
echo "  2. Test with: @zenode.chat \"Hello!\""
echo ""
echo -e "${BLUE}To revert changes:${NC}"
echo "  cp \"$BACKUP_PATH\" \"$CONFIG_PATH\""
echo ""
echo -e "${BLUE}To re-enable Zen later:${NC}"
echo "  Edit $CONFIG_PATH"
echo "  Rename 'zen-disabled' back to 'zen'"
echo "  Remove or rename 'zenode' to 'zenode-disabled'"