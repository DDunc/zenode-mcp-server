#!/bin/bash

# Local AI Model Setup Script for Zenode
# Sets up Ollama with lightweight models for gopher tool

set -e

echo "🔧 Setting up local AI model for Zenode Gopher tool..."

# Function to install Ollama if not present
install_ollama() {
    echo "📦 Installing Ollama..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install ollama
        else
            curl -fsSL https://ollama.ai/install.sh | sh
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -fsSL https://ollama.ai/install.sh | sh
    else
        echo "❌ Unsupported OS. Please install Ollama manually from https://ollama.ai"
        exit 1
    fi
}

# Function to check if Ollama is running
check_ollama_service() {
    if ! pgrep -x "ollama" > /dev/null; then
        echo "🚀 Starting Ollama service..."
        ollama serve &
        sleep 3
    fi
}

# Function to pull the best lightweight model
setup_model() {
    local model="$1"
    echo "📥 Pulling $model model..."
    
    if ollama pull "$model"; then
        echo "✅ Successfully pulled $model"
        return 0
    else
        echo "❌ Failed to pull $model"
        return 1
    fi
}

# Main setup logic
main() {
    # Check if Ollama is installed
    if ! command -v ollama &> /dev/null; then
        echo "🔍 Ollama not found. Installing..."
        install_ollama
    else
        echo "✅ Ollama found: $(ollama --version)"
    fi
    
    # Start Ollama service
    check_ollama_service
    
    # Try models in order of preference (smallest/fastest first)
    models=(
        "qwen2.5:0.5b"
        "llama3.2:1b" 
        "phi3.5:3.8b"
        "codeqwen:1.5b"
    )
    
    echo "🎯 Setting up lightweight AI model..."
    
    for model in "${models[@]}"; do
        echo "🔄 Trying $model..."
        if setup_model "$model"; then
            echo "🎉 Successfully set up $model as local AI model"
            
            # Test the model
            echo "🧪 Testing model..."
            if ollama run "$model" "Hello, can you help analyze code?" --verbose; then
                echo "✅ Model test successful!"
                echo "📝 Model $model is ready for use"
                
                # Save model name to config
                echo "$model" > "$(dirname "$0")/../.local-model"
                exit 0
            fi
        fi
    done
    
    echo "❌ Failed to set up any lightweight model. Please check your internet connection."
    exit 1
}

# Run main function
main "$@"