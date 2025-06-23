#!/bin/bash

# 🔑 API Key Update Script
# Safely update API keys after revoking exposed ones

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔑 API Key Update Tool${NC}"
echo "============================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please run from the zenode directory"
    exit 1
fi

# Backup current .env
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
echo -e "${GREEN}✅ Created backup of current .env${NC}"

# Check for exposed keys
echo ""
echo -e "${YELLOW}⚠️  Checking for exposed keys...${NC}"

EXPOSED_KEYS=(
    "sk-or-v1-EXPOSED-KEY-1-PLACEHOLDER-REPLACE-WITH-ACTUAL-EXPOSED-KEYS"
    "sk-or-v1-EXPOSED-KEY-2-PLACEHOLDER-REPLACE-WITH-ACTUAL-EXPOSED-KEYS" 
    "sk-proj-EXPOSED-OPENAI-KEY-PLACEHOLDER-REPLACE-WITH-ACTUAL-EXPOSED-KEY"
)

FOUND_EXPOSED=false
for key in "${EXPOSED_KEYS[@]}"; do
    if grep -q "$key" .env; then
        echo -e "${RED}❌ FOUND EXPOSED KEY: ${key:0:20}...${NC}"
        FOUND_EXPOSED=true
    fi
done

if [ "$FOUND_EXPOSED" = true ]; then
    echo ""
    echo -e "${RED}⚠️  CRITICAL: Exposed keys found in .env!${NC}"
    echo -e "${YELLOW}These keys must be revoked immediately:${NC}"
    echo ""
    echo "1. OpenRouter: https://openrouter.ai/keys"
    echo "2. OpenAI: https://platform.openai.com/api-keys"
    echo ""
    read -p "Have you revoked these keys? (yes/no): " revoked
    if [ "$revoked" != "yes" ]; then
        echo -e "${RED}Please revoke the exposed keys first!${NC}"
        exit 1
    fi
fi

# Update API keys
echo ""
echo -e "${BLUE}Let's update your API keys...${NC}"
echo ""

# Function to update a key in .env
update_key() {
    local key_name=$1
    local prompt_text=$2
    local current_value=$(grep "^$key_name=" .env | cut -d'=' -f2)
    
    # Check if it's a placeholder or exposed key
    if [[ "$current_value" == "your_"* ]] || [ "$FOUND_EXPOSED" = true ]; then
        echo -e "${YELLOW}$prompt_text${NC}"
        echo "Press Enter to skip if you don't have this key"
        read -p "New $key_name: " new_value
        
        if [ -n "$new_value" ]; then
            # Update the key in .env
            sed -i.tmp "s|^$key_name=.*|$key_name=$new_value|" .env
            rm -f .env.tmp
            echo -e "${GREEN}✅ Updated $key_name${NC}"
        else
            echo -e "${YELLOW}⏭️  Skipped $key_name${NC}"
        fi
    else
        echo -e "${GREEN}✓ $key_name already set (not exposed)${NC}"
    fi
    echo ""
}

# Update each API key
update_key "OPENROUTER_API_KEY" "Enter your NEW OpenRouter API key:"
update_key "OPENAI_API_KEY" "Enter your NEW OpenAI API key (optional):"
update_key "GEMINI_API_KEY" "Enter your Gemini API key (optional):"

# Restart containers to use new keys
echo ""
echo -e "${BLUE}🔄 Restarting containers with new API keys...${NC}"
docker-compose restart zenode

# Wait for container to be ready
echo -e "${YELLOW}⏳ Waiting for container to start...${NC}"
sleep 10

# Test the new configuration
echo ""
echo -e "${BLUE}🧪 Testing new configuration...${NC}"
if docker exec zenode-mcp sh -c 'node dist/index.js version' 2>&1 | grep -q "API key found"; then
    echo -e "${GREEN}✅ API keys loaded successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Check the logs if you encounter issues${NC}"
fi

echo ""
echo -e "${GREEN}🎉 API key update complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test zenode functionality with: zenode:chat \"Hello\""
echo "2. If issues occur, check logs: docker-compose logs zenode"
echo "3. Your old .env was backed up to: .env.backup.*"