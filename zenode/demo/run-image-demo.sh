#!/bin/bash

# Image Support Demo Runner
# This script compiles and runs the image demonstration

set -e

echo "🚀 Running Image Support Demonstration"
echo "====================================="

# Change to zenode directory
cd "$(dirname "$0")/.."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Compile TypeScript
echo "🔨 Compiling TypeScript..."
npm run build

# Run the demo
echo "▶️  Starting demo..."
echo ""
node dist/demo/image-demo.js

echo ""
echo "✨ Demo completed! Check the demo-output/ directory for results."