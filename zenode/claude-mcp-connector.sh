#!/bin/bash
# Claude MCP Connector Script for Zenode Docker Container
# This script connects Claude Code to the running zenode Docker container

# Ensure the container is running
if ! docker ps | grep -q "zenode-server"; then
    echo "Error: zenode-server container is not running" >&2
    echo "Please run: ./run-server.sh" >&2
    exit 1
fi

# Connect to the running container and execute the MCP server
exec docker exec -i zenode-server node dist/index.js