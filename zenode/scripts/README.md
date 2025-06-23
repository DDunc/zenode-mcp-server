# 📜 Zenode Scripts

Helper scripts to make zenode easier to use, especially for beginners.

## 🚀 quick-setup.sh

**What it does**: Sets up zenode in under 5 minutes with a friendly wizard

**When to use**: 
- First time setting up zenode
- Want to switch API providers
- Need to reconfigure your setup

**How to use**:
```bash
./scripts/quick-setup.sh
```

**Features**:
- 🎯 Guides you to the best free option (Gemini)
- 🔑 Helps you get and validate API keys
- ✅ Tests your connection automatically
- 💡 Provides helpful tips based on your choice

## 🏥 zenode-doctor.sh

**What it does**: Diagnoses common zenode problems

**When to use**:
- Zenode commands aren't working
- Getting "No models available" errors
- Want to check if everything is set up correctly

**How to use**:
```bash
./scripts/zenode-doctor.sh
```

**What it checks**:
- ✅ API key configuration
- ✅ Node.js version
- ✅ Docker status (if applicable)
- ✅ File permissions
- ✅ Common path issues
- ✅ API connectivity

## 🔧 Other Useful Scripts

### run-server.sh
Starts the zenode Docker containers with proper configuration

### fix-mcp-console-logs.sh
Fixes console output issues in MCP environment

### docker-build.sh
Builds Docker images for different platforms (AMD64, ARM64)

## 💡 Tips for Beginners

1. **Start with quick-setup.sh** - It's the easiest way to get started
2. **If something breaks**, run zenode-doctor.sh to diagnose
3. **Choose Gemini** for free API access when starting out
4. **Ask Claude** if you get stuck: "Help me run zenode setup"

## 🆘 Common Issues

**"Permission denied" when running scripts**
```bash
chmod +x ./scripts/*.sh
```

**"No such file or directory"**
Make sure you're in the zenode directory:
```bash
cd ~/path/to/zenode
```

**Scripts not working on Windows**
Use Git Bash or WSL (Windows Subsystem for Linux)