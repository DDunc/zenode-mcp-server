#!/bin/bash

# Get zenode conversation logs from Docker container

CONTAINER_NAME="zenode-server"
LOCAL_LOG_DIR="./zenode/.zenode/conversation-logs"

echo "Fetching conversation logs from Docker container..."

# Create local directory if it doesn't exist
mkdir -p "$LOCAL_LOG_DIR"

# Copy logs from container to local directory
docker cp "$CONTAINER_NAME:/app/.zenode/conversation-logs/." "$LOCAL_LOG_DIR/"

if [ $? -eq 0 ]; then
    echo "✅ Logs copied successfully!"
    echo "📁 Location: $LOCAL_LOG_DIR"
    echo "📄 Recent files:"
    ls -lat "$LOCAL_LOG_DIR" | head -6
else
    echo "❌ Failed to copy logs. Is the container running?"
    echo "💡 Try: docker ps to check container status"
fi