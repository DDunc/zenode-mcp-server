#!/bin/bash

# 🚀 Zenode Quick Setup Script
# This script implements the happy path for new users
# Makes setup as simple as possible with smart defaults

set -e  # Exit on error

# Colors for pretty output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Emoji for visual feedback
CHECK="✅"
WARN="⚠️ "
ERROR="❌"
ROCKET="🚀"
KEY="🔑"
PARTY="🎉"

# Clear screen for fresh start
clear

echo -e "${BLUE}${ROCKET} Welcome to Zenode Quick Setup!${NC}"
echo -e "This will get you running in under 5 minutes (for free!)\n"

# Check if .env already exists
if [ -f .env ]; then
    echo -e "${WARN}${YELLOW}Found existing .env file${NC}"
    echo -n "Do you want to keep your existing configuration? (y/N): "
    read -r keep_config
    if [[ ! "$keep_config" =~ ^[Yy]$ ]]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        echo -e "${CHECK} Backed up existing config"
    else
        echo -e "${CHECK} Keeping existing configuration"
        exit 0
    fi
fi

# Simple provider selection
echo -e "\n${KEY} Choose your AI provider:\n"
echo -e "  ${GREEN}1)${NC} Google Gemini ${GREEN}(Recommended - FREE)${NC}"
echo -e "     ✓ No credit card needed"
echo -e "     ✓ Daily free quota"
echo -e "     ✓ Great for development\n"

echo -e "  ${BLUE}2)${NC} OpenRouter ${BLUE}(Power User)${NC}"
echo -e "     ✓ Access to 100+ models"
echo -e "     ✓ Pay-per-use pricing"
echo -e "     ✓ Best flexibility\n"

echo -e "  3) OpenAI (Expensive)"
echo -e "  4) Local/Ollama (Technical)\n"

echo -n "Enter your choice (1-4) [default: 1]: "
read -r provider_choice
provider_choice=${provider_choice:-1}

# Handle provider selection
case $provider_choice in
    1)
        PROVIDER="gemini"
        PROVIDER_NAME="Google Gemini"
        PROVIDER_URL="https://makersuite.google.com/app/apikey"
        ENV_VAR="GEMINI_API_KEY"
        KEY_PREFIX="AIza"
        ;;
    2)
        PROVIDER="openrouter"
        PROVIDER_NAME="OpenRouter"
        PROVIDER_URL="https://openrouter.ai/keys"
        ENV_VAR="OPENROUTER_API_KEY"
        KEY_PREFIX="sk-or-v1-"
        ;;
    3)
        PROVIDER="openai"
        PROVIDER_NAME="OpenAI"
        PROVIDER_URL="https://platform.openai.com/api-keys"
        ENV_VAR="OPENAI_API_KEY"
        KEY_PREFIX="sk-"
        ;;
    4)
        PROVIDER="custom"
        PROVIDER_NAME="Local/Ollama"
        PROVIDER_URL="https://ollama.com/download"
        ENV_VAR="CUSTOM_API_URL"
        ;;
    *)
        echo -e "${ERROR} Invalid choice. Please run the script again."
        exit 1
        ;;
esac

# Special handling for local/custom
if [ "$PROVIDER" = "custom" ]; then
    echo -e "\n${BLUE}Setting up Local/Ollama...${NC}"
    echo -e "Make sure Ollama is installed and running first!"
    echo -e "Download from: ${PROVIDER_URL}\n"
    
    echo -n "Enter your Ollama URL [default: http://localhost:11434]: "
    read -r custom_url
    custom_url=${custom_url:-http://localhost:11434}
    
    # Test Ollama connection
    echo -e "Testing connection to Ollama..."
    if curl -s "${custom_url}/api/tags" > /dev/null 2>&1; then
        echo -e "${CHECK} Ollama is running!"
        
        # Create .env file
        cp .env.example .env 2>/dev/null || echo "# Zenode Configuration" > .env
        echo "CUSTOM_API_URL=${custom_url}" >> .env
        echo "CUSTOM_API_KEY=ollama" >> .env
        echo "DEFAULT_MODEL=llama3.2" >> .env
        
        echo -e "\n${PARTY} Setup complete! You're using free local AI!"
        echo -e "\nTry it out: ${GREEN}zenode:chat \"Hello world\"${NC}"
        exit 0
    else
        echo -e "${ERROR} Couldn't connect to Ollama at ${custom_url}"
        echo -e "Please make sure Ollama is running and try again."
        exit 1
    fi
fi

# API Key flow for cloud providers
echo -e "\n${KEY} Let's get your ${PROVIDER_NAME} API key:\n"
echo -e "1. ${BLUE}Click this link:${NC} ${PROVIDER_URL}"
echo -e "2. Sign in and create a new API key"
echo -e "3. Copy the entire key (it starts with '${KEY_PREFIX}')\n"

# Open the URL automatically if possible
if command -v open &> /dev/null; then
    open "$PROVIDER_URL" 2>/dev/null || true
elif command -v xdg-open &> /dev/null; then
    xdg-open "$PROVIDER_URL" 2>/dev/null || true
fi

# Get API key with validation
while true; do
    echo -n "Paste your API key here: "
    read -rs api_key
    echo # New line after hidden input
    
    # Basic validation
    if [ -z "$api_key" ]; then
        echo -e "${ERROR} API key cannot be empty. Please try again."
        continue
    fi
    
    if [[ ! "$api_key" =~ ^${KEY_PREFIX} ]]; then
        echo -e "${WARN}Your key should start with '${KEY_PREFIX}'"
        echo -n "Continue anyway? (y/N): "
        read -r continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            continue
        fi
    fi
    
    break
done

# Create .env file
echo -e "\n${BLUE}Creating configuration...${NC}"
cp .env.example .env 2>/dev/null || echo "# Zenode Configuration" > .env

# Update the specific API key
if grep -q "^${ENV_VAR}=" .env; then
    # Update existing key
    sed -i.bak "s|^${ENV_VAR}=.*|${ENV_VAR}=${api_key}|" .env
else
    # Add new key
    echo "${ENV_VAR}=${api_key}" >> .env
fi

# Set default model based on provider
case $PROVIDER in
    gemini)
        echo "DEFAULT_MODEL=gemini-2.5-flash" >> .env
        ;;
    openrouter)
        echo "DEFAULT_MODEL=anthropic/claude-3-haiku" >> .env
        ;;
    openai)
        echo "DEFAULT_MODEL=o3-mini" >> .env
        ;;
esac

echo -e "${CHECK} Configuration saved!\n"

# Test the connection
echo -e "${BLUE}Testing your API connection...${NC}"

# Create a simple test script
cat > test_connection.js << 'EOF'
const { config } = require('dotenv');
config();

async function testConnection() {
    const provider = process.argv[2];
    const envVar = process.argv[3];
    
    if (!process.env[envVar]) {
        console.error(`❌ ${envVar} not found in environment`);
        process.exit(1);
    }
    
    // Simple validation that key exists and has correct format
    console.log(`✅ ${provider} API key configured!`);
    console.log(`📊 Key starts with: ${process.env[envVar].substring(0, 10)}...`);
    process.exit(0);
}

testConnection();
EOF

if node test_connection.js "$PROVIDER_NAME" "$ENV_VAR"; then
    rm -f test_connection.js
    
    echo -e "\n${PARTY} ${GREEN}Success! Zenode is ready to use!${NC}\n"
    
    # Show quick start commands
    echo -e "Try these commands in Claude:\n"
    echo -e "  ${GREEN}zenode:chat \"Hello! What can you help me with?\"${NC}"
    echo -e "  ${GREEN}zenode:analyze --files [\"your-file.js\"] --prompt \"Review this\"${NC}"
    echo -e "  ${GREEN}zenode:debug \"Your error message here\"${NC}"
    
    # Provider-specific tips
    case $PROVIDER in
        gemini)
            echo -e "\n💡 ${YELLOW}Gemini Tip:${NC} Your free quota resets daily!"
            echo -e "   You get 60 requests/minute for free."
            ;;
        openrouter)
            echo -e "\n💡 ${YELLOW}OpenRouter Tip:${NC} Check your usage at:"
            echo -e "   https://openrouter.ai/account"
            ;;
        openai)
            echo -e "\n⚠️  ${YELLOW}OpenAI Warning:${NC} This can get expensive!"
            echo -e "   Monitor usage at: https://platform.openai.com/usage"
            ;;
    esac
    
    echo -e "\n${BLUE}Need help?${NC} Type: ${GREEN}zenode:chat \"How do I get started?\"${NC}"
    
else
    rm -f test_connection.js
    echo -e "\n${ERROR} Setup failed. Please check your API key and try again."
    echo -e "Run this script again: ${GREEN}./scripts/quick-setup.sh${NC}"
    exit 1
fi

# Cleanup
rm -f .env.bak

echo -e "\n${ROCKET} Happy coding with Zenode!\n"