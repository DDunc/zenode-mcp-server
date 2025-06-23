# 🎯 Getting Started with Zenode: The Complete Beginner's Guide

Welcome! This guide will help you set up zenode in the easiest way possible. No prior experience needed - we'll explain everything step by step.

## 🤔 What You'll Need (5 minutes to gather)

1. **Claude Desktop App** - You probably already have this!
2. **A code editor** (like VS Code, Cursor, or Windsurf)
3. **5-10 minutes** of your time
4. **$0** - We'll use free options!

## 📍 Where Are You Starting From?

First, let's check if zenode is already installed. In Claude, type:

```
zenode:version
```

- ✅ **If you see version info**: Great! Skip to [Step 2: Get Your API Key](#step-2-get-your-free-api-key)
- ❌ **If you see an error**: No worries! You need to install zenode first

### Installing Zenode (If Needed)

The easiest way is to ask Claude to help you:

```
Can you help me install zenode MCP server on my computer?
```

Claude will guide you through the process. Come back here when done!

## 🚀 The Happy Path: 3 Simple Steps

We're going to use **Google Gemini** because it's:
- ✅ Completely FREE to start
- ✅ No credit card required  
- ✅ Works great for most tasks
- ✅ Takes only 5 minutes to set up

### Step 1: Open Your Terminal

**If you're using VS Code, Cursor, or Windsurf:**
1. Open your editor
2. Look for "Terminal" in the menu bar
3. Click `Terminal → New Terminal`
4. A command line will appear at the bottom

> 💡 **What's a terminal?** It's just a place where you can type commands to your computer. Think of it like texting your computer!

### Step 2: Get Your Free API Key

1. **Open this link in your browser**: https://makersuite.google.com/app/apikey
   
2. **Sign in with Google** (use any Gmail account)

3. **Click "Create API Key"**
   - If asked, create a new project (any name is fine)
   - Click "Create API Key in new project"

4. **Copy your API key**
   - It looks like this: `AIzaSyB-abcdef123456...` (but longer)
   - Click the copy button or select all and copy
   - **Keep this tab open** - we'll need it in a second!

> 🔒 **Security Note**: Your API key is like a password. Don't share it publicly!

### Step 3: Tell Zenode About Your Key

Now the fun part! Go back to Claude and type:

```
zenode:config setup
```

Claude will respond with something like:

```
🔧 Zenode Configuration Setup

Select a provider to configure:
1. gemini - Google Gemini API
2. openai - OpenAI API  
3. openrouter - OpenRouter API
4. custom - Custom API endpoint

Enter your choice (1-4):
```

**Type `1` and press Enter** (for Gemini)

Then it will ask for your API key:

```
Enter your Gemini API key:
```

**Paste your API key** (Ctrl+V or Cmd+V) and press Enter

You should see:

```
✅ Configuration saved successfully!
✅ Gemini provider configured
🎉 You can now use zenode tools!
```

## 🎊 That's It! You're Done!

### Test If Everything Works

Let's make sure everything is set up correctly. In Claude, type:

```
zenode:chat "Hello! Can you see this message?"
```

If zenode responds with a friendly message, you're all set! 🎉

### What Can You Do Now?

Try these fun commands:

```
# Get help with coding questions
zenode:chat "How do I center a div in CSS?"

# Analyze your code
zenode:analyze --files ["/path/to/your/file.js"] --prompt "How can I improve this?"

# Debug issues
zenode:debug "My React component keeps re-rendering infinitely"
```

## ❓ Common Issues & Solutions

### "No models available"
**Solution**: Your API key might be wrong. Run `zenode:config setup` again.

### "Rate limit exceeded"  
**Solution**: You're using the free tier too fast. Wait a bit or upgrade to paid.

### "Cannot find zenode:chat"
**Solution**: Zenode isn't installed. Ask Claude: "Help me install zenode MCP server"

### "Invalid API key"
**Solution**: Make sure you copied the entire key. It should start with `AIza...`

## 💡 Pro Tips for Beginners

1. **Start with zenode:chat** - It's the friendliest tool to begin with
2. **Use quotes** around your questions: `zenode:chat "your question here"`
3. **Be specific** - Instead of "fix this", try "why does this function return undefined?"
4. **Save money** - Gemini's free tier resets daily, so you get fresh quota each day!

## 🤔 Confused About Docker?

Good news: **You don't need to understand Docker!** 

If you see Docker mentioned anywhere:
- It's just a way to run zenode in a container (like a mini-computer inside your computer)
- The setup we just did handles everything automatically
- You can ignore Docker-related instructions for now

## 📚 What's Next?

Now that you're set up, explore what zenode can do:

1. **Ask coding questions**: `zenode:chat "Explain Python lists vs JavaScript arrays"`
2. **Review your code**: `zenode:codereview --files ["./my-code.js"]`
3. **Debug problems**: `zenode:debug "Error: undefined is not a function"`

## 🆘 Need More Help?

- **Ask Claude**: "How do I use zenode for [your task]?"
- **Check examples**: `zenode:chat "Show me zenode examples"`
- **Community**: Visit the [Zenode Discord](https://discord.gg/zenode) (if available)

---

### 🎯 Quick Reference Card

Save this for later:

```bash
# Setup (one time only)
zenode:config setup  # Choose 1 for Gemini

# Daily use
zenode:chat "Your question"     # General help
zenode:analyze --files ["..."]  # Analyze code
zenode:debug "Error message"    # Fix problems
zenode:codereview --files ["..."] # Review code

# If something breaks
zenode:config validate  # Check your setup
zenode:config list     # See your configuration
```

Welcome to the zenode community! You've got this! 🚀