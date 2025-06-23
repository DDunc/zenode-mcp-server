#!/bin/bash

# 🔐 Install Pre-commit Hook for Secret Scanning
# This script installs a git pre-commit hook that runs the secret scanner

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔐 Installing Pre-commit Security Hook${NC}"
echo "===================================="

# Get the repository root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check if we're in zenode or root
if [[ "$PWD" == *"/zenode"* ]]; then
    HOOK_DIR="$REPO_ROOT/.git/hooks"
    SCANNER_PATH="zenode/scripts/check-secrets.sh"
else
    HOOK_DIR="$REPO_ROOT/.git/hooks"
    SCANNER_PATH="scripts/check-secrets.sh"
fi

# Create hooks directory if it doesn't exist
mkdir -p "$HOOK_DIR"

# Create pre-commit hook
cat > "$HOOK_DIR/pre-commit" << 'EOF'
#!/bin/bash
# Pre-commit hook for secret scanning

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Running security scan before commit...${NC}"

# Find the check-secrets.sh script
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ -f "$REPO_ROOT/zenode/scripts/check-secrets.sh" ]; then
    SCANNER="$REPO_ROOT/zenode/scripts/check-secrets.sh"
elif [ -f "$REPO_ROOT/scripts/check-secrets.sh" ]; then
    SCANNER="$REPO_ROOT/scripts/check-secrets.sh"
else
    echo -e "${YELLOW}⚠️  Warning: Secret scanner not found${NC}"
    echo -e "${YELLOW}   Continuing with commit...${NC}"
    exit 0
fi

# Run the scanner
if "$SCANNER"; then
    echo -e "${GREEN}✅ Security scan passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Security scan failed!${NC}"
    echo -e "${RED}   Secrets detected in staged files.${NC}"
    echo -e "${YELLOW}   Please remove secrets before committing.${NC}"
    echo ""
    echo -e "${YELLOW}To bypass this check (NOT RECOMMENDED):${NC}"
    echo -e "  git commit --no-verify"
    exit 1
fi
EOF

# Make hook executable
chmod +x "$HOOK_DIR/pre-commit"

echo -e "${GREEN}✅ Pre-commit hook installed successfully!${NC}"
echo ""
echo "The secret scanner will now run automatically before each commit."
echo ""
echo -e "${YELLOW}To test the hook:${NC}"
echo "  1. Stage some files: git add ."
echo "  2. Try to commit: git commit -m \"test\""
echo ""
echo -e "${YELLOW}To bypass the hook (emergency only):${NC}"
echo "  git commit --no-verify"
echo ""
echo -e "${GREEN}🔒 Your repository is now protected against accidental secret commits!${NC}"