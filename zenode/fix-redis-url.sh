#!/bin/bash

# Redis URL Fix Script - Replace localhost with redis hostname

set -e

echo "🔧 FIXING REDIS URL CONFIGURATION"
echo "================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "\n${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Find hardcoded localhost Redis URLs in source
print_step "Searching for hardcoded localhost Redis URLs in source files"

echo "Searching TypeScript source files:"
grep -r "localhost:6379" src/ || echo "No localhost:6379 found in src/"

echo -e "\nSearching config files:"
grep -r "localhost:6379" . --include="*.ts" --include="*.js" --include="*.json" || echo "No localhost:6379 found in config files"

# Step 2: Check compiled JavaScript files  
print_step "Checking compiled JavaScript files for localhost references"

echo "Searching dist/ directory:"
find dist/ -name "*.js" -exec grep -l "localhost:6379" {} \; | head -10

echo -e "\nShowing context for localhost:6379 references:"
find dist/ -name "*.js" -exec grep -n "localhost:6379" {} + | head -20

# Step 3: Find REDIS_URL usage patterns
print_step "Analyzing REDIS_URL usage patterns"

echo "Looking for REDIS_URL environment variable usage in source:"
grep -r "REDIS_URL" src/ || echo "No REDIS_URL found in src/"

echo -e "\nLooking for REDIS_URL in compiled code:"
find dist/ -name "*.js" -exec grep -n "REDIS_URL" {} + | head -10

# Step 4: Check config.js for default values
print_step "Checking config files for default Redis URL"

if [ -f "src/config.ts" ]; then
    echo "Contents of src/config.ts (Redis-related):"
    grep -A 5 -B 5 -i redis src/config.ts || echo "No Redis config found"
fi

if [ -f "dist/config.js" ]; then
    echo -e "\nContents of dist/config.js (Redis-related):"
    grep -A 5 -B 5 -i redis dist/config.js || echo "No Redis config found"
fi

# Step 5: Create a Redis URL override script
print_step "Creating Redis URL override test"

echo "Testing Redis URL environment variable override:"
docker-compose exec zenode node -e "
console.log('=== REDIS URL ANALYSIS ===');
console.log('process.env.REDIS_URL:', process.env.REDIS_URL);

// Try to find where localhost is coming from
const originalConsoleLog = console.log;
console.log = function(...args) {
    const str = args.join(' ');
    if (str.includes('localhost') || str.includes('6379')) {
        originalConsoleLog('🚨 LOCALHOST DETECTED:', ...args);
        console.trace();
    }
    originalConsoleLog(...args);
};

// Load the config module
try {
    const config = require('./dist/config.js');
    console.log('=== CONFIG MODULE ===');
    Object.keys(config).forEach(key => {
        if (typeof config[key] === 'string' && config[key].includes('redis')) {
            console.log(\`Config \${key}:\`, config[key]);
        }
    });
} catch (err) {
    console.log('❌ Failed to load config:', err.message);
}

console.log('=== DONE ===');
"

print_step "Fix Complete - Analysis Results Above"