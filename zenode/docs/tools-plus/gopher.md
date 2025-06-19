# Gopher Tool - Local File Access Bridge

**🔍 LOCAL FILE ACCESS BRIDGE - File system operations for containerized tools**

The `zenode:gopher` tool provides essential file system access capabilities to zenode's containerized environment. It serves as a bridge between zenode's Docker containers and the local file system, enabling file operations, directory listings, and content searches that other zenode tools rely on.

## Key Features

- **Container-safe file access** - Handles `/workspace/` path mapping automatically
- **Directory operations** - List, search, and navigate file systems
- **File existence checking** - Verify files before analysis
- **Content searching** - Grep and glob pattern matching
- **Smart path resolution** - Automatic local-to-container path conversion
- **Integration foundation** - Enables other zenode tools to access files

## Tool Parameters

- `action`: Operation to perform (required)
  - `read_file` - Read file contents
  - `list_directory` - List directory contents
  - `glob_search` - Pattern-based file search
  - `grep_search` - Content-based file search
  - `file_exists` - Check if file exists
  - `analyze_code` - Basic code analysis
  - `smart_search` - Intelligent file discovery
- `path`: Target file or directory path (required, use `/workspace/` paths)
- `pattern`: Search pattern for glob/grep operations
- `query`: Search query for smart search
- `include`: File filter pattern (e.g., "*.ts", "*.{js,jsx}")
- `recursive`: Enable recursive directory operations (default: false)
- `limit`: Maximum number of results to return

## Action Types

### `file_exists` - File Existence Check
Verify that files exist before analysis:
```bash
zenode:gopher --action file_exists --path "/workspace/src/app.ts"
```

### `read_file` - File Content Reading
Read file contents directly:
```bash
zenode:gopher --action read_file --path "/workspace/package.json"
```

### `list_directory` - Directory Listing
List contents of directories:
```bash
zenode:gopher --action list_directory --path "/workspace/src" --recursive true
```

### `glob_search` - Pattern-Based File Search
Find files matching glob patterns:
```bash
zenode:gopher --action glob_search --path "/workspace" --pattern "**/*.ts" --limit 20
```

### `grep_search` - Content-Based Search
Search for text content within files:
```bash
zenode:gopher --action grep_search --path "/workspace/src" --pattern "useState" --include "*.{ts,tsx}"
```

### `smart_search` - Intelligent File Discovery
Advanced search with context understanding:
```bash
zenode:gopher --action smart_search --path "/workspace" --query "authentication logic" --include "*.ts"
```

### `analyze_code` - Basic Code Analysis
Perform basic code structure analysis:
```bash
zenode:gopher --action analyze_code --path "/workspace/src/components"
```

## Usage Examples

### Pre-Analysis File Verification
```bash
# Before using other zenode tools, verify files exist
zenode:gopher --action file_exists --path "/workspace/src/auth/auth.service.ts"

# If exists, proceed with analysis
zenode:analyze --files ["/workspace/src/auth/auth.service.ts"] --prompt "Review authentication implementation"
```

### Project Structure Discovery
```bash
# Explore project structure
zenode:gopher --action list_directory --path "/workspace" --recursive false

# Find all TypeScript files
zenode:gopher --action glob_search --path "/workspace" --pattern "**/*.ts" --limit 50

# Find specific component types
zenode:gopher --action glob_search --path "/workspace/src" --pattern "**/components/**/*.tsx"
```

### Code Search and Discovery
```bash
# Find all files containing specific patterns
zenode:gopher --action grep_search --path "/workspace/src" --pattern "useEffect" --include "*.{ts,tsx}"

# Search for API endpoints
zenode:gopher --action grep_search --path "/workspace" --pattern "app\.(get|post|put|delete)" --include "*.{js,ts}"

# Find configuration files
zenode:gopher --action glob_search --path "/workspace" --pattern "**/config/**/*" --include "*.{json,js,ts,yaml,yml}"
```

### Smart Content Discovery
```bash
# Find authentication-related code
zenode:gopher --action smart_search --path "/workspace" --query "user authentication and authorization" --include "*.ts"

# Locate database models
zenode:gopher --action smart_search --path "/workspace" --query "database models and schemas" --include "*.{ts,js}"

# Find test files for specific functionality
zenode:gopher --action smart_search --path "/workspace" --query "unit tests for API endpoints" --include "*.{test,spec}.{ts,js}"
```

### Integration with Other Zenode Tools
```bash
# Step 1: Discover relevant files
FILES=$(zenode:gopher --action glob_search --path "/workspace/src" --pattern "**/auth/**/*.ts")

# Step 2: Analyze with context
zenode:analyze --files $FILES --prompt "Review authentication system architecture"

# Step 3: Code review
zenode:codereview --files $FILES --prompt "Security audit of authentication system"
```

## Zenode-Specific Features

### Automatic Path Translation
Gopher automatically handles Docker container path mapping:
```bash
# Input can be local or container paths
zenode:gopher --action file_exists --path "/Users/you/project/src/app.ts"
# Automatically translates to: /workspace/project/src/app.ts
```

### Container-Safe Operations
All file operations respect container boundaries and security:
- **Read-only access** to mounted volumes
- **Path validation** prevents directory traversal
- **Resource limits** prevent excessive file system usage
- **Error handling** for permission and access issues

### Integration Foundation
Gopher enables other zenode tools to function properly:
```bash
# Gopher verifies files before zenode:analyze
zenode:analyze --files ["/workspace/src/app.ts"] --prompt "Review code quality"
# Internally calls: gopher.file_exists("/workspace/src/app.ts")

# Gopher discovers files for zenode:codereview
zenode:codereview --files ["/workspace/src/**/*.ts"] --prompt "Security audit"
# Internally expands glob pattern via gopher
```

## Advanced Usage Patterns

### Project Onboarding
```bash
# Discover project structure
zenode:gopher --action analyze_code --path "/workspace"

# Find main entry points
zenode:gopher --action smart_search --path "/workspace" --query "main application entry point" --include "*.{ts,js}"

# Locate configuration
zenode:gopher --action glob_search --path "/workspace" --pattern "**/package.json" 
zenode:gopher --action glob_search --path "/workspace" --pattern "**/*.config.{js,ts,json}"
```

### Codebase Health Check
```bash
# Find all test files
zenode:gopher --action glob_search --path "/workspace" --pattern "**/*.{test,spec}.{ts,js,tsx,jsx}"

# Search for TODO/FIXME comments
zenode:gopher --action grep_search --path "/workspace" --pattern "(TODO|FIXME|HACK)" --include "*.{ts,js,tsx,jsx}"

# Find unused imports
zenode:gopher --action grep_search --path "/workspace" --pattern "import.*from.*['\"].*['\"]" --include "*.{ts,tsx}"
```

### Security and Compliance Scanning
```bash
# Find potential security issues
zenode:gopher --action grep_search --path "/workspace" --pattern "(password|secret|key|token)" --include "*.{ts,js,json}"

# Search for hardcoded credentials
zenode:gopher --action grep_search --path "/workspace" --pattern "\\b[A-Za-z0-9]{32,}\\b" --include "*.{ts,js}"

# Find environment variable usage
zenode:gopher --action grep_search --path "/workspace" --pattern "process\\.env\\." --include "*.{ts,js}"
```

### Dependencies and Architecture Analysis
```bash
# Find all import statements
zenode:gopher --action grep_search --path "/workspace" --pattern "^import" --include "*.{ts,tsx}"

# Locate API definitions
zenode:gopher --action smart_search --path "/workspace" --query "REST API routes and endpoints" --include "*.{ts,js}"

# Find database-related code
zenode:gopher --action smart_search --path "/workspace" --query "database queries and ORM usage" --include "*.{ts,js}"
```

## Configuration and Performance

### Resource Limits
Gopher operations are limited to prevent system overload:
- **Maximum file size**: 10MB per file read
- **Directory depth**: 10 levels for recursive operations
- **Search results**: 1000 files maximum per search
- **Pattern complexity**: Simple regex patterns only

### Caching and Optimization
- **Directory listings** cached for 30 seconds
- **File existence checks** cached for 10 seconds
- **Glob patterns** optimized for common use cases
- **Smart search** uses indexes when available

### Error Handling
```bash
# Graceful handling of missing files
zenode:gopher --action file_exists --path "/workspace/nonexistent.ts"
# Returns: {"exists": false, "error": null}

# Informative error messages
zenode:gopher --action read_file --path "/workspace/large-file.bin"
# Returns: {"error": "File too large for reading (limit: 10MB)"}
```

## Best Practices

### Efficient File Discovery
- **Use specific patterns** instead of broad searches
- **Limit recursive depth** when not needed
- **Filter by file extensions** to reduce noise
- **Use smart_search** for content-based discovery

### Integration Patterns
```bash
# Always verify before processing
if zenode:gopher --action file_exists --path "/workspace/config.json"; then
  zenode:analyze --files ["/workspace/config.json"] --prompt "Review configuration"
fi

# Batch file operations
FILES=$(zenode:gopher --action glob_search --path "/workspace/src" --pattern "**/*.ts")
zenode:codereview --files $FILES --prompt "Code quality review"
```

### Performance Optimization
- **Use include patterns** to filter file types early
- **Set reasonable limits** for large codebases
- **Cache directory listings** for repeated operations
- **Avoid deep recursion** unless necessary

## Troubleshooting

### Common Issues

**File not found errors:**
```bash
# Check if path exists
zenode:gopher --action file_exists --path "/workspace/your/file.ts"

# List parent directory
zenode:gopher --action list_directory --path "/workspace/your"
```

**Permission errors:**
```bash
# Verify container permissions
docker exec zenode-server ls -la /workspace/

# Check volume mounts
docker-compose config | grep -A5 -B5 volumes
```

**Large result sets:**
```bash
# Use more specific patterns
zenode:gopher --action glob_search --path "/workspace" --pattern "src/**/*.ts" --limit 20

# Filter by file type
zenode:gopher --action grep_search --pattern "useState" --include "*.tsx" --limit 10
```

### Debug Commands
```bash
# Test basic functionality
zenode:gopher --action list_directory --path "/workspace"

# Verify file access
zenode:gopher --action file_exists --path "/workspace/package.json"

# Check container status
zenode:version
docker-compose ps
```

## API Reference

### Return Format
All gopher operations return structured JSON:
```json
{
  "success": true,
  "action": "file_exists",
  "path": "/workspace/src/app.ts",
  "result": {
    "exists": true,
    "size": 1024,
    "modified": "2025-06-19T10:30:00Z"
  },
  "metadata": {
    "execution_time": "15ms",
    "cache_hit": false
  }
}
```

### Error Responses
```json
{
  "success": false,
  "action": "read_file",
  "path": "/workspace/missing.ts",
  "error": "File not found",
  "error_code": "ENOENT"
}
```

The zenode:gopher tool is essential infrastructure that enables the entire zenode ecosystem to work seamlessly with containerized file systems while maintaining security and performance.