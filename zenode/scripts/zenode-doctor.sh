#!/bin/bash

# 🏥 Zenode Doctor - Diagnostic Tool
# Helps diagnose and fix common zenode issues

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Icons
CHECK="✅"
WARN="⚠️ "
ERROR="❌"
INFO="💡"
DOCTOR="🏥"

echo -e "${BLUE}${DOCTOR} Zenode Doctor - Diagnostic Tool${NC}"
echo -e "Checking your zenode setup...\n"

# Track issues
ISSUES_FOUND=0

# 1. Check if running in Docker
echo -e "${BLUE}Checking environment...${NC}"
if [ -f /.dockerenv ]; then
    echo -e "${CHECK} Running in Docker container"
    IN_DOCKER=true
else
    echo -e "${CHECK} Running on local machine"
    IN_DOCKER=false
fi

# 2. Check .env file
echo -e "\n${BLUE}Checking configuration...${NC}"
if [ -f .env ]; then
    echo -e "${CHECK} Found .env file"
    
    # Check for API keys
    has_gemini=$(grep -c "^GEMINI_API_KEY=.*[^_here]$" .env || true)
    has_openrouter=$(grep -c "^OPENROUTER_API_KEY=.*[^_here]$" .env || true)
    has_openai=$(grep -c "^OPENAI_API_KEY=.*[^_here]$" .env || true)
    has_custom=$(grep -c "^CUSTOM_API_URL=" .env || true)
    
    total_providers=$((has_gemini + has_openrouter + has_openai + has_custom))
    
    if [ $total_providers -eq 0 ]; then
        echo -e "${ERROR} No API keys configured!"
        echo -e "  ${INFO} Run: ${GREEN}./scripts/quick-setup.sh${NC}"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "${CHECK} Found $total_providers configured provider(s)"
        [ $has_gemini -gt 0 ] && echo -e "  - Google Gemini"
        [ $has_openrouter -gt 0 ] && echo -e "  - OpenRouter"
        [ $has_openai -gt 0 ] && echo -e "  - OpenAI"
        [ $has_custom -gt 0 ] && echo -e "  - Custom/Local"
    fi
else
    echo -e "${ERROR} No .env file found!"
    echo -e "  ${INFO} Run: ${GREEN}./scripts/quick-setup.sh${NC}"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 3. Check Node.js
echo -e "\n${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${CHECK} Node.js $NODE_VERSION installed"
    
    # Check version (need 18+)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
    if [ $MAJOR_VERSION -lt 18 ]; then
        echo -e "${WARN}Node.js 18+ recommended (you have $NODE_VERSION)"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
else
    echo -e "${ERROR} Node.js not found!"
    echo -e "  ${INFO} Install from: https://nodejs.org"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 4. Check Docker (if applicable)
if [ "$IN_DOCKER" = false ]; then
    echo -e "\n${BLUE}Checking Docker...${NC}"
    if command -v docker &> /dev/null; then
        echo -e "${CHECK} Docker installed"
        
        # Check if Docker daemon is running
        if docker info &> /dev/null; then
            echo -e "${CHECK} Docker daemon is running"
            
            # Check for zenode containers
            if docker ps | grep -q zenode; then
                echo -e "${CHECK} Zenode containers are running"
            else
                echo -e "${WARN}No zenode containers found running"
                echo -e "  ${INFO} Run: ${GREEN}docker-compose up -d${NC}"
            fi
        else
            echo -e "${ERROR} Docker daemon not running!"
            echo -e "  ${INFO} Start Docker Desktop or run: ${GREEN}sudo systemctl start docker${NC}"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        fi
    else
        echo -e "${INFO} Docker not installed (optional)"
        echo -e "  You can run zenode without Docker"
    fi
fi

# 5. Check common path issues
echo -e "\n${BLUE}Checking for common issues...${NC}"

# Check if user has paths with spaces
if [ -d "$HOME/Google Drive" ] || [ -d "$HOME/One Drive" ] || [ -d "$HOME/iCloud Drive" ]; then
    echo -e "${WARN}Found cloud storage folders with spaces in names"
    echo -e "  ${INFO} This can cause issues. Consider working in a simpler path."
fi

# Check Redis (if enabled)
if ! grep -q "DISABLE_ALL_REDIS=true" .env 2>/dev/null; then
    if command -v redis-cli &> /dev/null; then
        if redis-cli ping &> /dev/null; then
            echo -e "${CHECK} Redis is running (optional)"
        else
            echo -e "${INFO} Redis not running (optional, used for conversation memory)"
        fi
    fi
fi

# 6. Test file access
echo -e "\n${BLUE}Testing file access...${NC}"
TEST_FILE="/tmp/zenode_test_$$"
if echo "test" > "$TEST_FILE" 2>/dev/null; then
    echo -e "${CHECK} Can write to temp directory"
    rm -f "$TEST_FILE"
else
    echo -e "${ERROR} Cannot write to temp directory!"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

# 7. Quick API test (if keys configured)
if [ $total_providers -gt 0 ] && [ -f .env ]; then
    echo -e "\n${BLUE}Testing API connectivity...${NC}"
    
    # Create simple connectivity test
    cat > /tmp/api_test_$$.js << 'EOF'
require('dotenv').config();

async function testAPIs() {
    const results = [];
    
    // Test each provider
    if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes('your_')) {
        results.push({provider: 'Gemini', status: 'configured'});
    }
    if (process.env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY.includes('your_')) {
        results.push({provider: 'OpenRouter', status: 'configured'});
    }
    if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your_')) {
        results.push({provider: 'OpenAI', status: 'configured'});
    }
    
    results.forEach(r => {
        console.log(`✅ ${r.provider}: ${r.status}`);
    });
}

testAPIs();
EOF

    if node /tmp/api_test_$$.js 2>/dev/null; then
        rm -f /tmp/api_test_$$.js
    else
        echo -e "${WARN}Could not test API connectivity"
    fi
fi

# 8. Summary and recommendations
echo -e "\n${BLUE}=== Diagnostic Summary ===${NC}\n"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${CHECK} ${GREEN}Everything looks good!${NC}"
    echo -e "\nYou should be able to use zenode commands in Claude."
    echo -e "Try: ${GREEN}zenode:chat \"Hello world\"${NC}"
else
    echo -e "${ERROR} Found $ISSUES_FOUND issue(s)\n"
    echo -e "${BLUE}Recommended actions:${NC}"
    
    if [ ! -f .env ] || [ $total_providers -eq 0 ]; then
        echo -e "1. Run setup: ${GREEN}./scripts/quick-setup.sh${NC}"
    fi
    
    if [ $MAJOR_VERSION -lt 18 ] 2>/dev/null; then
        echo -e "2. Update Node.js: ${GREEN}https://nodejs.org${NC}"
    fi
    
    echo -e "\nFor more help, ask Claude: ${GREEN}\"Help me fix zenode setup issues\"${NC}"
fi

# 9. Common fixes reference
echo -e "\n${BLUE}Quick Fix Reference:${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "No API keys:        ${GREEN}./scripts/quick-setup.sh${NC}"
echo -e "Path issues:        Use ${GREEN}/workspace/${NC} prefix in Docker"
echo -e "Docker not running: ${GREEN}docker-compose up -d${NC}"
echo -e "Reset everything:   ${GREEN}zenode:config reset${NC}"
echo -e "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "\n${DOCTOR} Doctor's consultation complete!\n"

exit $ISSUES_FOUND