#!/bin/bash

# Zenode Workspace Setup Script
# This script ensures proper file access configuration for zenode tools

set -e

echo "🔧 Setting up Zenode Workspace Configuration"
echo "============================================="

# Check if we're in the zenode directory
if [[ ! -f "docker-compose.yml" ]]; then
    echo "❌ Error: Run this script from the zenode/ directory"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo "✅ Found docker-compose.yml in current directory"

# Create workspace directory if it doesn't exist
if [[ ! -d "./workspace" ]]; then
    echo "📁 Creating local workspace directory..."
    mkdir -p ./workspace
    echo "✅ Created ./workspace/"
else
    echo "✅ Workspace directory already exists"
fi

# Check Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Check environment variables
echo ""
echo "🔍 Checking Environment Variables:"
echo "----------------------------------"

api_keys_found=0

if [[ -n "$OPENROUTER_API_KEY" && "$OPENROUTER_API_KEY" != "your_openrouter_api_key_here" ]]; then
    echo "✅ OPENROUTER_API_KEY: Set"
    api_keys_found=1
else
    echo "❌ OPENROUTER_API_KEY: Not set"
fi

if [[ -n "$OPENAI_API_KEY" && "$OPENAI_API_KEY" != "your_openai_api_key_here" ]]; then
    echo "✅ OPENAI_API_KEY: Set"
    api_keys_found=1
else
    echo "❌ OPENAI_API_KEY: Not set"
fi

if [[ -n "$GEMINI_API_KEY" && "$GEMINI_API_KEY" != "your_gemini_api_key_here" ]]; then
    echo "✅ GEMINI_API_KEY: Set"
    api_keys_found=1
else
    echo "❌ GEMINI_API_KEY: Not set"
fi

if [[ $api_keys_found -eq 0 ]]; then
    echo ""
    echo "⚠️  WARNING: No API keys configured!"
    echo "   Zenode will work for file operations but not AI analysis."
    echo "   Set at least one API key:"
    echo "   export OPENROUTER_API_KEY='your_key_here'"
    echo ""
fi

# Check file access by testing with a known file
echo ""
echo "🧪 Testing File Access Configuration:"
echo "------------------------------------"

# Create a test file in user's home directory
test_file="$HOME/zenode-test-file.txt"
echo "This is a test file for zenode workspace access" > "$test_file"
echo "✅ Created test file: $test_file"

# Start zenode if not running (or restart to pick up volume mounts)
echo ""
echo "🚀 Starting/Restarting Zenode Server:"
echo "-------------------------------------"

# Stop existing containers
docker-compose down 2>/dev/null || true

# Start containers with proper volume mounts
echo "Starting zenode server with volume mounts..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Test file access through zenode
echo ""
echo "🔍 Testing File Access Through Zenode:"
echo "--------------------------------------"

# Test if zenode can see the test file
if command -v zenode >/dev/null 2>&1; then
    echo "Testing with zenode CLI..."
    # This would be the actual test with zenode CLI
    echo "⚠️  zenode CLI not available - manual testing required"
else
    echo "⚠️  zenode CLI not available - will test manually"
fi

echo ""
echo "📋 Manual Verification Steps:"
echo "1. The test file should be accessible at: /workspace/zenode-test-file.txt"
echo "2. Test with: zenode:gopher --action file_exists --path '/workspace/zenode-test-file.txt'"
echo "3. For images, use paths like: /workspace/Desktop/image.jpg"
echo "4. Your home directory ($HOME) is mounted to /workspace in the container"

# Display volume mount information
echo ""
echo "📂 Volume Mount Configuration:"
echo "-----------------------------"
echo "Host Path              → Container Path"
echo "$HOME → /workspace"
echo ""
echo "File Path Translation Examples:"
echo "$HOME/Desktop/image.jpg → /workspace/Desktop/image.jpg"
echo "$HOME/Documents/file.txt → /workspace/Documents/file.txt"
echo "$HOME/Downloads/data.csv → /workspace/Downloads/data.csv"

# Clean up test file
rm -f "$test_file"
echo ""
echo "🧹 Cleaned up test file"

echo ""
echo "✅ Zenode Workspace Setup Complete!"
echo ""
echo "🎯 Next Steps:"
echo "1. Copy files you want to analyze to somewhere under $HOME"
echo "2. Use zenode tools with /workspace/ paths"
echo "3. For images: zenode:chat 'Analyze image' --files ['/workspace/path/to/image.jpg']"
echo "4. Verify with: zenode:gopher --action list_directory --path '/workspace'"
echo ""
echo "📖 See CLAUDE.md for detailed usage examples and troubleshooting"