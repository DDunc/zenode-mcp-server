# Zenode Workspace Path Usage Guide

## Overview

Zenode now supports intelligent path resolution that works with both relative and absolute paths, eliminating the need for confusing `/workspace/` prefixes while providing full project access.

## Docker Configuration

The workspace is configured to provide full access to the project root:

```yaml
# docker-compose.yml
volumes:
  - ..:/workspace:rw  # Maps parent directory to /workspace
working_dir: /workspace/zenode  # Sets working directory to zenode folder
```

## Path Resolution Examples

### ✅ Relative Paths (Recommended)

```bash
# Relative to zenode directory (current working directory)
zenode:gopher --action read_file --path "src/tools/chat.ts"
zenode:gopher --action list_directory --path "docs"
zenode:analyze --files ["src/index.ts"] --prompt "Review main entry point"

# Navigate up to project root
zenode:gopher --action read_file --path "../README.md"
zenode:gopher --action list_directory --path "../docs"

# Current directory shortcuts
zenode:gopher --action read_file --path "./package.json"
zenode:gopher --action list_directory --path "./"
```

### ✅ Absolute Paths (Also Supported)

```bash
# Workspace-absolute paths
zenode:gopher --action read_file --path "/workspace/zenode/src/tools/chat.ts"
zenode:gopher --action read_file --path "/workspace/README.md"

# Local filesystem paths (auto-converted)
zenode:gopher --action read_file --path "/Users/edunc/Documents/gitz/zen-mcp-server/zenode/src/index.ts"
# ↳ Automatically converted to: /workspace/Documents/gitz/zen-mcp-server/zenode/src/index.ts
```

### ✅ Home Directory Shortcuts

```bash
# Home directory navigation
zenode:gopher --action read_file --path "~/Documents/gitz/zen-mcp-server/zenode/package.json"
# ↳ Resolves to: /workspace/Documents/gitz/zen-mcp-server/zenode/package.json
```

## Intelligent Path Resolution

The `resolveZenodePath()` function handles path resolution automatically:

1. **Absolute Paths**: 
   - `/workspace/*` → Used as-is
   - `/Users/*` or `/home/*` → Mapped to `/workspace/*`
   - Other absolute paths → Assumed workspace-relative

2. **Relative Paths**:
   - `./` or `../` → Resolved relative to current working directory (`/workspace/zenode`)
   - `~/` → Mapped to `/workspace/`
   - Plain filenames → Resolved relative to zenode directory

3. **Security**: All paths are validated to ensure they stay within the workspace

## Migration from Old Syntax

### Before (Required /workspace/ prefix)
```bash
❌ zenode:gopher --action read_file --path "/workspace/Documents/gitz/zen-mcp-server/zenode/src/tools/chat.ts"
```

### After (Clean relative paths)
```bash
✅ zenode:gopher --action read_file --path "src/tools/chat.ts"
```

## Full Project Access

The workspace provides access to the entire project:

```
/workspace/                     # Project root (zen-mcp-server)
├── zenode/                     # ← Working directory
│   ├── src/                   # ← "src/tools/chat.ts" 
│   ├── docs/                  # ← "docs/"
│   └── package.json           # ← "./package.json"
├── docs/                      # ← "../docs/"
├── README.md                  # ← "../README.md"
└── CLAUDE.md                  # ← "../CLAUDE.md"
```

## Best Practices

1. **Use relative paths** for cleaner commands:
   ```bash
   ✅ zenode:gopher --action read_file --path "src/index.ts"
   ❌ zenode:gopher --action read_file --path "/workspace/zenode/src/index.ts"
   ```

2. **Navigate naturally**:
   ```bash
   # Zenode files
   zenode:analyze --files ["src/tools/"] --prompt "Review tools"
   
   # Project root files  
   zenode:analyze --files ["../docs/"] --prompt "Review documentation"
   ```

3. **Mix path types as needed**:
   ```bash
   # Combine relative and absolute paths
   zenode:analyze --files ["src/index.ts", "/workspace/README.md"] --prompt "Compare"
   ```

## Troubleshooting

### Path Not Found
```bash
# Verify file exists first
zenode:gopher --action file_exists --path "src/tools/missing.ts"

# List directory contents
zenode:gopher --action list_directory --path "src/tools"
```

### Access Denied
- Ensure paths stay within `/workspace/`
- Check file permissions if running locally

### Unexpected Behavior
- Use absolute workspace paths for debugging: `/workspace/zenode/src/file.ts`
- Check current working directory is `/workspace/zenode`

## Summary

Zenode's intelligent path system provides:
- **Natural relative paths** from zenode working directory
- **Full project access** to entire zen-mcp-server repository  
- **Backward compatibility** with absolute paths
- **Automatic path conversion** for local filesystem paths
- **Security boundaries** within the workspace

No more confusing `/workspace/` prefixes - just use paths naturally!