#!/bin/bash

# Zenode Path Converter Script
# Automatically converts local file paths to zenode container paths

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Zenode Path Converter${NC}"
echo "========================="

# Function to convert a single path
convert_path() {
    local input_path="$1"
    local converted_path=""
    
    # Get the current user's home directory
    local home_dir="$HOME"
    
    # Check if path starts with home directory
    if [[ "$input_path" == "$home_dir"* ]]; then
        # Replace home directory with /workspace
        converted_path="/workspace${input_path#$home_dir}"
    elif [[ "$input_path" == "/Users/"* ]]; then
        # Handle absolute /Users/ paths
        local username=$(echo "$input_path" | cut -d'/' -f3)
        local user_home="/Users/$username"
        converted_path="/workspace${input_path#$user_home}"
    elif [[ "$input_path" == "/home/"* ]]; then
        # Handle Linux /home/ paths
        local username=$(echo "$input_path" | cut -d'/' -f3)
        local user_home="/home/$username"
        converted_path="/workspace${input_path#$user_home}"
    elif [[ "$input_path" == "./"* ]] || [[ "$input_path" == "../"* ]]; then
        # Handle relative paths
        local abs_path=$(realpath "$input_path" 2>/dev/null || echo "$input_path")
        if [[ "$abs_path" == "$home_dir"* ]]; then
            converted_path="/workspace${abs_path#$home_dir}"
        else
            converted_path="$input_path"
        fi
    else
        # Path doesn't need conversion or is already a container path
        converted_path="$input_path"
    fi
    
    echo "$converted_path"
}

# Function to generate zenode command with converted paths
generate_zenode_command() {
    local tool="$1"
    local prompt="$2"
    shift 2
    local files=("$@")
    
    local converted_files=()
    for file in "${files[@]}"; do
        converted_files+=($(convert_path "$file"))
    done
    
    echo "zenode:$tool \"$prompt\" --files [\"$(IFS='", "'; echo "${converted_files[*]}")\"]"
}

# Function to validate file exists in container
validate_container_path() {
    local container_path="$1"
    
    # Remove /workspace prefix to get local path
    local local_path="$HOME${container_path#/workspace}"
    
    if [[ -f "$local_path" ]]; then
        echo -e "${GREEN}✅ File exists${NC}: $local_path"
        return 0
    else
        echo -e "${RED}❌ File not found${NC}: $local_path"
        return 1
    fi
}

# Interactive mode
if [[ $# -eq 0 ]]; then
    echo "Usage modes:"
    echo "1. Interactive: $0"
    echo "2. Convert path: $0 convert /path/to/file"
    echo "3. Generate command: $0 chat \"analyze this\" /path/to/file1 /path/to/file2"
    echo ""
    
    while true; do
        echo -e "${YELLOW}Choose an option:${NC}"
        echo "1. Convert single file path"
        echo "2. Generate zenode command with path conversion"
        echo "3. Validate container file access"
        echo "4. Show path mapping examples"
        echo "5. Exit"
        
        read -p "Enter choice (1-5): " choice
        
        case $choice in
            1)
                read -p "Enter local file path: " local_path
                if [[ -n "$local_path" ]]; then
                    container_path=$(convert_path "$local_path")
                    echo -e "${GREEN}Converted path:${NC} $container_path"
                    
                    # Validate the file exists
                    validate_container_path "$container_path"
                fi
                echo ""
                ;;
            2)
                read -p "Enter zenode tool (chat, analyze, debug, etc.): " tool
                read -p "Enter prompt: " prompt
                read -p "Enter file paths (space-separated): " -a file_paths
                
                if [[ -n "$tool" && -n "$prompt" && ${#file_paths[@]} -gt 0 ]]; then
                    echo -e "${GREEN}Generated zenode command:${NC}"
                    generate_zenode_command "$tool" "$prompt" "${file_paths[@]}"
                fi
                echo ""
                ;;
            3)
                read -p "Enter container path (starting with /workspace): " container_path
                validate_container_path "$container_path"
                echo ""
                ;;
            4)
                echo -e "${BLUE}Path Mapping Examples:${NC}"
                echo "Local Path                              → Container Path"
                echo "$HOME/Desktop/image.jpg                → /workspace/Desktop/image.jpg"
                echo "$HOME/Documents/project/src/file.ts    → /workspace/Documents/project/src/file.ts"
                echo "$HOME/Downloads/data.csv               → /workspace/Downloads/data.csv"
                echo "./local-file.txt                       → /workspace/$(realpath ./local-file.txt 2>/dev/null | sed "s|$HOME||")"
                echo ""
                ;;
            5)
                echo "Goodbye!"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice${NC}"
                ;;
        esac
    done
fi

# Command line modes
command="$1"
case "$command" in
    "convert")
        if [[ -n "$2" ]]; then
            converted=$(convert_path "$2")
            echo "$converted"
            validate_container_path "$converted" >/dev/null 2>&1 || true
        else
            echo "Usage: $0 convert /path/to/file"
            exit 1
        fi
        ;;
    "chat"|"analyze"|"debug"|"thinkdeep"|"codereview"|"testgen")
        if [[ -n "$2" && $# -gt 2 ]]; then
            prompt="$2"
            shift 2
            files=("$@")
            generate_zenode_command "$command" "$prompt" "${files[@]}"
        else
            echo "Usage: $0 $command \"prompt\" /path/to/file1 [/path/to/file2 ...]"
            exit 1
        fi
        ;;
    *)
        echo "Unknown command: $command"
        echo "Available commands: convert, chat, analyze, debug, thinkdeep, codereview, testgen"
        exit 1
        ;;
esac