#!/bin/bash
# Zenode MCP Server - Multi-Architecture Docker Build Script
# Builds optimized containers for Apple Silicon and Linux deployment
# Based on 2025 Docker multi-platform best practices

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="zenode-mcp"
VERSION="1.0.0"
REGISTRY_PREFIX=""  # Set this if pushing to a registry

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker buildx is available
check_buildx() {
    if ! docker buildx version &> /dev/null; then
        log_error "Docker buildx is not available. Please install Docker Desktop or enable buildx."
        exit 1
    fi
    log_info "Docker buildx is available"
}

# Create buildx builder if it doesn't exist
setup_builder() {
    local builder_name="zenode-builder"
    
    if ! docker buildx inspect "$builder_name" &> /dev/null; then
        log_info "Creating multi-platform builder: $builder_name"
        docker buildx create --name "$builder_name" --driver docker-container --bootstrap
    fi
    
    docker buildx use "$builder_name"
    log_info "Using builder: $builder_name"
}

# Build multi-architecture image
build_multi_arch() {
    local platforms="linux/amd64,linux/arm64"
    local image_tag="${REGISTRY_PREFIX}${IMAGE_NAME}:${VERSION}"
    local latest_tag="${REGISTRY_PREFIX}${IMAGE_NAME}:latest"
    
    log_info "Building multi-architecture image for platforms: $platforms"
    log_info "Image tags: $image_tag, $latest_tag"
    
    docker buildx build \
        --platform "$platforms" \
        --tag "$image_tag" \
        --tag "$latest_tag" \
        --file Dockerfile \
        --push=false \
        --load=false \
        .
    
    log_success "Multi-architecture build completed"
}

# Build Apple Silicon optimized image
build_apple_silicon() {
    local image_tag="${IMAGE_NAME}:${VERSION}-arm64"
    local latest_tag="${IMAGE_NAME}:latest-arm64"
    
    log_info "Building Apple Silicon optimized image"
    
    docker build \
        --platform linux/arm64 \
        --tag "$image_tag" \
        --tag "$latest_tag" \
        --file Dockerfile.arm64 \
        .
    
    log_success "Apple Silicon build completed: $image_tag"
}

# Build Linux production image
build_linux() {
    local image_tag="${IMAGE_NAME}:${VERSION}-linux"
    local latest_tag="${IMAGE_NAME}:latest-linux"
    
    log_info "Building Linux production image"
    
    docker build \
        --platform linux/amd64 \
        --tag "$image_tag" \
        --tag "$latest_tag" \
        --file Dockerfile.linux \
        .
    
    log_success "Linux build completed: $image_tag"
}

# Build local development image (current platform)
build_local() {
    local image_tag="${IMAGE_NAME}:${VERSION}-local"
    local latest_tag="${IMAGE_NAME}:latest"
    
    log_info "Building local development image"
    
    docker build \
        --tag "$image_tag" \
        --tag "$latest_tag" \
        --file Dockerfile \
        .
    
    log_success "Local build completed: $image_tag"
}

# Validate .env file exists
check_env_file() {
    if [[ ! -f .env ]]; then
        log_warning ".env file not found. Creating from .env.example..."
        if [[ -f .env.example ]]; then
            cp .env.example .env
            log_info "Please edit .env file with your API keys before running containers"
        else
            log_error "No .env.example file found. Please create .env file with required API keys."
            exit 1
        fi
    else
        log_info ".env file found"
    fi
}

# Show usage information
show_usage() {
    echo "Usage: $0 [command]"
    echo
    echo "Commands:"
    echo "  multi-arch    Build multi-architecture image (linux/amd64,linux/arm64)"
    echo "  apple         Build Apple Silicon optimized image (arm64)"
    echo "  linux         Build Linux production image (amd64)"
    echo "  local         Build local development image (current platform)"
    echo "  all           Build all variants"
    echo "  help          Show this help message"
    echo
    echo "Examples:"
    echo "  $0 local      # Quick local build for development"
    echo "  $0 apple      # Apple Silicon optimized build"
    echo "  $0 linux      # Linux production build"
    echo "  $0 all        # Build all variants"
}

# Main execution
main() {
    local command="${1:-local}"
    
    # Validate environment
    check_env_file
    
    case "$command" in
        "multi-arch")
            check_buildx
            setup_builder
            build_multi_arch
            ;;
        "apple")
            build_apple_silicon
            ;;
        "linux")
            build_linux
            ;;
        "local")
            build_local
            ;;
        "all")
            log_info "Building all Docker variants..."
            build_local
            build_apple_silicon
            build_linux
            # check_buildx
            # setup_builder
            # build_multi_arch
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
    
    log_success "Docker build process completed!"
    echo
    log_info "Next steps:"
    echo "  1. Update .env file with your API keys"
    echo "  2. Run: docker-compose up -d"
    echo "  3. Test with: docker-compose logs zenode"
}

# Run main function with all arguments
main "$@"