#!/bin/bash

# 🔍 Secret Scanner for Zenode
# Checks for accidentally exposed API keys or secrets

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔍 Scanning for exposed secrets..."
echo "================================"

FOUND_ISSUES=0

# Patterns to search for
declare -a PATTERNS=(
    "sk-[a-zA-Z0-9]{20,}"           # OpenAI keys
    "sk-or-v1-[a-zA-Z0-9]{40,}"     # OpenRouter keys
    "AIza[a-zA-Z0-9_-]{35}"         # Google/Gemini keys
    "api_key.*=.*['\"][a-zA-Z0-9]{20,}" # Generic API keys
    "secret.*=.*['\"][a-zA-Z0-9]{20,}"  # Generic secrets
)

# Files to exclude from scanning
EXCLUDE_PATTERNS=(
    "*.git/*"
    "*node_modules/*"
    "*.env"
    "*.env.*"
    ".env"
    ".env.*"
    "*.env.example"
    "*.env.test.example"
    "*check-secrets.sh"
    "*SECURITY.md"
    "*.min.js"
    "*.map"
    "*dist/*"
    "*build/*"
    "*logs/*"
    "*.log"
)

# Build exclude arguments for grep
EXCLUDE_ARGS=""
for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$pattern"
done

# Check each pattern
for pattern in "${PATTERNS[@]}"; do
    echo -n "Checking for pattern: $pattern ... "
    
    # Only scan git-tracked files to avoid checking local .env files
    if git ls-files -z | xargs -0 grep -l -E "$pattern" 2>/dev/null | grep -v "your_.*_key_here" | grep -v "placeholder" | grep -v "example" | grep -v "\.md$"; then
        echo -e "${RED}FOUND!${NC}"
        FOUND_ISSUES=$((FOUND_ISSUES + 1))
    else
        echo -e "${GREEN}Clean${NC}"
    fi
done

# Check for .env files that might be staged or tracked
echo -n "Checking for tracked .env files ... "
if git ls-files | grep -E "\.env" | grep -v -E "\.example|\.md"; then
    echo -e "${RED}FOUND!${NC}"
    echo -e "${YELLOW}Warning: .env files should never be committed!${NC}"
    FOUND_ISSUES=$((FOUND_ISSUES + 1))
else
    echo -e "${GREEN}Clean${NC}"
fi

# Only scan files that are tracked by git (to avoid scanning local .env files)
echo ""
echo "Scanning only git-tracked files for better performance..."

# Summary
echo "================================"
if [ $FOUND_ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ No secrets found! Good job!${NC}"
else
    echo -e "${RED}❌ Found $FOUND_ISSUES potential security issues!${NC}"
    echo -e "${YELLOW}Please review and remove any exposed secrets.${NC}"
    echo -e "${YELLOW}If these are false positives, update the exclude patterns.${NC}"
fi

exit $FOUND_ISSUES