# Zenode Docker Workspace Access Analysis

## 🎭 AI Council Discussion: Docker File Permissions & Workspace Access

*The council convenes with 🐞 The Problem Solver, 🔍 The Detective, and 🧠 The Philosopher to discuss the critical issue of Docker workspace access for zenode tools.*

---

## Executive Summary

The zenode MCP server runs in Docker containers and requires access to local files for its various AI tools. This creates a fundamental tension between security (minimal access) and functionality (tools need broad file access). Our investigation revealed that the current approach of mounting the entire home directory (`${HOME}:/workspace`) is functional but carries significant security risks.

## The Core Problem

### 🐞 The Problem Solver identifies:
Let me trace through this systematically. The issue manifests as:

1. **Path Translation Mismatch**: Tools expect `/Users/edunc/file.txt` but files are mounted at `/workspace/file.txt`
2. **ENOENT Errors**: "No such file or directory" when files clearly exist on host
3. **Permission Conflicts**: Container user (UID 1000) may not match host user
4. **Cross-Platform Inconsistency**: Windows WSL, macOS, and Linux handle mounts differently

The root cause: We're trying to give containerized tools transparent access to an entire filesystem they don't understand.

### 🔍 The Detective investigates:
Show me the evidence. Let's examine the current configuration:

```yaml
# Current docker-compose.yml
volumes:
  - ${HOME}:/workspace:rw  # SECURITY RISK: Exposes entire home directory
  - ${MCP_WORKSPACE:-./workspace}:/workspace:ro  # Redundant/conflicting mount
```

This is problematic. We're mounting the ENTIRE home directory with read-write permissions. That means:
- SSH keys at `~/.ssh` are exposed
- AWS credentials at `~/.aws` are accessible  
- Browser profiles, password managers, everything is vulnerable

Let's verify the actual risk:
```bash
docker exec zenode-server ls -la /workspace/.ssh
docker exec zenode-server cat /workspace/.aws/credentials
```

If those commands work, we have a serious security issue.

### 🧠 The Philosopher contemplates:
But have we considered the deeper implications? This isn't just a technical problem - it's a philosophical one about trust boundaries.

When we mount the home directory, we're essentially saying "this container is an extension of my local environment." But containers exist precisely to create isolation. We're violating the principle of least privilege.

Yet users expect zenode tools to "just work" with their files. They don't want to think about container boundaries. How do we reconcile security with usability?

---

## Current Implementation Analysis

### Volume Mounting Strategy

The current approach uses a simple but dangerous strategy:

```yaml
volumes:
  - ${HOME}:/workspace:rw
```

**Pros:**
- Simple to understand
- Works immediately with any file in home directory
- No user configuration needed

**Cons:**
- Massive security risk (exposes sensitive files)
- Performance impact (large directory trees)
- Breaks container isolation principles
- Platform-specific issues (Windows path handling)

### Path Translation Issues

Users provide paths like:
- `/Users/edunc/Documents/project/file.js`
- `~/Desktop/screenshot.png`
- `./relative/path.txt`

But inside the container, these become:
- `/workspace/Documents/project/file.js`
- `/workspace/Desktop/screenshot.png`
- `/workspace/[unknown]/relative/path.txt`

This mismatch causes constant confusion and errors.

## Security Risk Assessment

### 🔍 The Detective's Security Audit:

**Critical Risks:**
1. **Credential Exposure**: SSH keys, API tokens, AWS credentials all accessible
2. **Data Exfiltration**: Any file in home directory can be read/copied
3. **Modification Risk**: With `:rw` mount, files can be altered or deleted
4. **Cross-Container Contamination**: Other containers could access same mount

**Verification Commands:**
```bash
# Check what sensitive files are exposed
docker exec zenode-server find /workspace -name "id_rsa" -o -name ".env" -o -name "credentials" 2>/dev/null

# Test write permissions
docker exec zenode-server touch /workspace/test-write-access.txt

# Check container user permissions
docker exec zenode-server id
docker exec zenode-server ls -la /workspace/
```

## Alternative Approaches

### 1. Project-Specific Mounting (Recommended)

Instead of mounting entire home directory, mount only the current project:

```yaml
volumes:
  - ${PWD}:/workspace:rw  # Only current directory
  - ${HOME}/.gitconfig:/home/node/.gitconfig:ro  # Specific configs as needed
```

**Implementation:**
```bash
# Update docker-compose.yml to use PWD
sed -i 's/${HOME}:\/workspace/${PWD}:\/workspace/g' docker-compose.yml

# Add project detection to run-server.sh
if [ -z "$ZENODE_WORKSPACE" ]; then
  export ZENODE_WORKSPACE="$PWD"
fi
```

### 2. Explicit Workspace Declaration

Require users to explicitly declare workspace directories:

```bash
# .zenode-workspace file
workspace:
  - ~/Documents/projects
  - ~/Desktop
  - /tmp/zenode-safe
```

### 3. Volume Driver Approach

Use Docker volume drivers for better control:

```yaml
volumes:
  workspace:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${ZENODE_WORKSPACE:-$PWD}
```

### 4. Capability-Based Access

Implement a capability system where tools request specific access:

```typescript
interface FileAccessRequest {
  path: string;
  operation: 'read' | 'write' | 'list';
  reason: string;
}

// Tools must request access
const access = await requestFileAccess({
  path: '/workspace/src',
  operation: 'read',
  reason: 'Analyzing source code structure'
});
```

## Platform-Specific Considerations

### macOS
- File system events don't propagate correctly
- Use `:delegated` mount option for performance
- Handle case-insensitive filesystem issues

### Linux  
- UID/GID mapping critical for permissions
- Consider user namespaces for security
- Native performance, fewer issues

### Windows (WSL2)
- Path translation most complex (`C:\` → `/mnt/c/`)
- Performance issues with cross-filesystem mounts
- Recommend keeping files within WSL2 filesystem

## Deep Dive: PWD vs HOME Mounting

### 🔍 The Detective investigates PWD implications:

Let me examine what switching from `${HOME}:/workspace` to `${PWD}:/workspace` actually means:

**The Critical Question**: Will PWD give us what Claude Code has - access to local project files?

**Answer**: No, not exactly. Here's why:

1. **Claude Code's Access**: Claude has access to your ENTIRE filesystem through native OS APIs
2. **Zenode with PWD**: Only has access to the current directory and its subdirectories
3. **The Gap**: If you run zenode from `~/projects/app1` but need to access `~/projects/app2`, it won't work

**Verification Test**:
```bash
# Scenario 1: Running from project directory
cd ~/projects/myapp
docker-compose up -d  # PWD = ~/projects/myapp
zenode:analyze --files ["./src/index.js"]  # ✅ Works

# Scenario 2: Running from home directory  
cd ~
docker-compose up -d  # PWD = ~
zenode:analyze --files ["./projects/myapp/src/index.js"]  # ✅ Works (but exposes entire home!)

# Scenario 3: Cross-project access
cd ~/projects/app1
docker-compose up -d  # PWD = ~/projects/app1
zenode:analyze --files ["../app2/src/index.js"]  # ❌ Fails - app2 not in mount
```

### 🧠 The Philosopher's perspective:

But have we considered that Claude Code and Zenode serve different trust models?

- **Claude Code**: Trusted local application with full filesystem access
- **Zenode Docker**: Isolated service with controlled access

Perhaps the limitation is actually a feature? It forces users to be intentional about what they expose.

### Hybrid Approach: Best of Both Worlds

```yaml
# docker-compose.yml with smart defaults
services:
  zenode-server:
    volumes:
      # Primary workspace - configurable
      - ${ZENODE_WORKSPACE:-$PWD}:/workspace:rw
      
      # Optional additional mounts for multi-project access
      - ${ZENODE_EXTRA_MOUNT_1:-/dev/null}:/extra1:ro
      - ${ZENODE_EXTRA_MOUNT_2:-/dev/null}:/extra2:ro
```

**Usage patterns**:
```bash
# Single project (secure by default)
cd ~/projects/myapp
docker-compose up -d

# Multi-project access (explicit opt-in)
export ZENODE_WORKSPACE="$HOME/projects"
export ZENODE_EXTRA_MOUNT_1="$HOME/Documents"
docker-compose up -d

# Maximum access (power user who accepts risks)
export ZENODE_WORKSPACE="$HOME"
docker-compose up -d
```

## Apple Silicon (ARM64) Support

### 🐞 The Problem Solver's Analysis:

Good news! The zenode project is already well-prepared for Apple Silicon:

1. **Multi-Architecture Dockerfile**: Uses `--platform=$BUILDPLATFORM` for cross-platform builds
2. **Dedicated ARM64 Dockerfile**: `Dockerfile.arm64` with specific optimizations
3. **Compatible Base Images**: `node:20-alpine` supports ARM64 natively
4. **Redis Support**: `redis:7-alpine` runs great on Apple Silicon

**Verification on Apple Silicon**:
```bash
# Check Docker platform
docker version --format '{{.Server.Arch}}'  # Should show 'arm64'

# Build for ARM64
docker buildx build --platform linux/arm64 -t zenode:arm64 -f Dockerfile.arm64 .

# Run with native performance
docker-compose up -d

# Verify architecture
docker exec zenode-server uname -m  # Should show 'aarch64'
```

**Performance Optimizations for Apple Silicon**:
```dockerfile
# In Dockerfile.arm64
FROM --platform=linux/arm64 node:20-alpine

# Install dependencies with ARM64 optimizations
RUN npm ci --platform=linux --arch=arm64

# Use native ARM64 binaries where possible
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    # ARM64-optimized packages
```

### Platform-Specific Considerations

1. **Rosetta 2 Fallback**: Docker Desktop can run x86_64 images via emulation, but native is 2-5x faster
2. **Memory Pressure**: Apple Silicon shares memory between CPU/GPU, so set appropriate limits
3. **Volume Performance**: Use `:delegated` mount option for better performance on macOS

```yaml
# Optimized for Apple Silicon
services:
  zenode-server:
    platform: linux/arm64  # Force ARM64
    volumes:
      - ${PWD}:/workspace:delegated  # Better macOS performance
    deploy:
      resources:
        limits:
          memory: 4G  # Respect unified memory architecture
```

## Recommended Solution

### 🐞 The Problem Solver's Implementation Plan:

1. **Immediate Fix**: Use configurable mounting with secure defaults
2. **Security Hardening**: PWD by default, HOME requires explicit opt-in
3. **User Experience**: Clear documentation on access patterns
4. **Apple Silicon**: Already supported, just needs testing
5. **Configuration**: Flexible environment variables for different use cases

```bash
# Updated docker-compose.yml
version: '3.8'

services:
  zenode-server:
    volumes:
      # Primary workspace - current directory or explicit path
      - ${ZENODE_WORKSPACE:-$PWD}:/workspace:rw
      
      # Optional: Specific read-only mounts for common needs
      - ${HOME}/.gitconfig:/config/.gitconfig:ro
      - ${HOME}/.ssh/known_hosts:/config/.ssh/known_hosts:ro
      
    environment:
      - WORKSPACE_MODE=${WORKSPACE_MODE:-project}
      - WORKSPACE_ROOT=/workspace
```

### User Configuration File

Create `~/.zenode/config.yaml`:

```yaml
workspace:
  mode: project  # or 'home' for power users who understand risks
  allowed_paths:
    - ~/Documents/code
    - ~/Projects
    - /tmp
  excluded_paths:
    - ~/.ssh
    - ~/.aws
    - ~/.config/gh
```

### Enhanced Error Messages

When file access fails, provide actionable guidance:

```typescript
catch (error) {
  if (error.code === 'ENOENT') {
    throw new Error(`
File not found: ${requestedPath}

The file exists on your host but isn't accessible in the zenode container.

Solutions:
1. Run zenode from the project directory containing this file
2. Set ZENODE_WORKSPACE to the parent directory:
   export ZENODE_WORKSPACE="/Users/you/projects"
3. Use relative paths from your current directory

Current workspace: ${process.env.WORKSPACE_ROOT}
Available files: Run 'zenode:gopher --action list_directory --path /workspace'
    `);
  }
}
```

## Security Best Practices

### 🔍 The Detective's Security Checklist:

1. **Principle of Least Privilege**
   - Mount only what's needed
   - Default to read-only
   - Require explicit write permissions

2. **Verification Commands**
   ```bash
   # Audit what's accessible
   docker exec zenode-server find /workspace -type f -name "*.pem" -o -name "*.key"
   
   # Check mount permissions
   docker exec zenode-server mount | grep workspace
   
   # Verify user context
   docker exec zenode-server whoami && id
   ```

3. **Runtime Security**
   - Drop unnecessary capabilities
   - Run as non-root user
   - Enable security options:
   ```yaml
   security_opt:
     - no-new-privileges:true
     - seccomp:unconfined  # Adjust based on needs
   ```

4. **Audit Logging**
   ```typescript
   // Log all file access attempts
   logFileAccess({
     tool: 'analyze',
     path: requestedPath,
     operation: 'read',
     success: true,
     timestamp: new Date()
   });
   ```

## Migration Guide

### For Users

1. **Update your workflow**:
   ```bash
   # Old way (dangerous)
   cd ~
   zenode:analyze --files ["/Users/me/anywhere/file.js"]
   
   # New way (safe)
   cd ~/projects/myproject
   zenode:analyze --files ["./src/file.js"]
   ```

2. **Set workspace explicitly**:
   ```bash
   export ZENODE_WORKSPACE="$HOME/Documents/code"
   ```

3. **Use relative paths when possible**

### For Developers

1. Update path resolution logic
2. Add workspace boundary checks
3. Implement clear error messages
4. Add security warnings for home directory mounts

## Testing Strategy

### Verification Tests

```bash
#!/bin/bash
# test-workspace-access.sh

echo "Testing workspace access patterns..."

# Test 1: Current directory access
cd /tmp && echo "test" > test.txt
docker exec zenode-server cat /workspace/test.txt || echo "FAIL: Current dir access"

# Test 2: Security boundary
docker exec zenode-server cat /workspace/../etc/passwd 2>&1 | grep -q "Permission denied" || echo "FAIL: Security boundary"

# Test 3: Write permissions
docker exec zenode-server touch /workspace/write-test.txt || echo "FAIL: Write permissions"

# Test 4: Sensitive file protection
docker exec zenode-server ls /workspace/.ssh 2>&1 | grep -q "No such file" || echo "FAIL: SSH keys exposed!"
```

## Conclusion

### 🧠 The Philosopher's Synthesis:

The tension between security and usability isn't a problem to solve - it's a balance to maintain. The current "mount everything" approach prioritizes convenience over security, but we can do better.

By moving to project-based mounting with explicit workspace configuration, we:
- Maintain usability for the common case
- Dramatically improve security posture  
- Provide escape hatches for power users
- Create clear mental models for users

Remember: Containers exist to create boundaries. Let's respect those boundaries while making the experience as seamless as possible.

### 🎯 Key Recommendations:

1. **Immediate**: Switch to `${PWD}:/workspace` mounting
2. **Short-term**: Implement workspace configuration system
3. **Long-term**: Build capability-based file access with user consent
4. **Always**: Educate users about security implications

The path forward is clear: Project-scoped access by default, with optional extensions for those who need more.