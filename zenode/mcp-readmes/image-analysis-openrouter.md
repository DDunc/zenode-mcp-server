# Image Analysis with Zenode & OpenRouter

Complete guide to using image analysis capabilities in Zenode MCP Server with OpenRouter's vision models.

## Table of Contents
- [Quick Start](#quick-start)
- [Setup](#setup)
- [Supported Models](#supported-models)
- [Usage Examples](#usage-examples)
- [File Formats & Limits](#file-formats--limits)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# 1. Set your OpenRouter API key
export OPENROUTER_API_KEY=your_openrouter_key_here

# 2. Use any zenode tool with images
zenode:chat "What do you see in this image?" --images /path/to/image.png --model anthropic/claude-3-sonnet
```

## Setup

### Environment Configuration

```bash
# Required: OpenRouter API Key
export OPENROUTER_API_KEY=your_openrouter_key_here

# Optional: Enable Claude Opus (requires explicit opt-in)
export ENABLE_CLAUDE_OPUS=true

# Optional: Set default model
export DEFAULT_MODEL=anthropic/claude-4-sonnet
```

### Verify Setup

```bash
# Test OpenRouter connection and image capabilities
node -e "
import('./src/providers/openrouter.js').then(async ({ OpenRouterProvider }) => {
  const provider = new OpenRouterProvider(process.env.OPENROUTER_API_KEY);
  const caps = await provider.getImageCapabilities('anthropic/claude-3-sonnet');
  console.log('Image support:', caps.supportsImages ? '✅' : '❌');
  console.log('Max size:', caps.maxImageSizeMB + 'MB');
  console.log('Formats:', caps.supportedFormats.join(', '));
});
"
```

**Expected Output:**
```
Image support: ✅
Max size: 5MB
Formats: .jpg, .jpeg, .png, .gif, .webp
```

## Supported Models

### Best OpenRouter Vision Models (June 2025)

| Model | Alias | Max Size | Context | Best For |
|-------|-------|----------|---------|----------|
| `meta-llama/llama-4-maverick-17b-instruct` | - | 15MB | 1M | Latest tech, complex analysis |
| `meta-llama/llama-4-scout` | - | 15MB | 10M | Visual reasoning, large context |
| `anthropic/claude-sonnet-4-20250514` | `sonnet4` | 5MB | 200K | Hybrid thinking, code analysis |
| `anthropic/claude-3-5-sonnet-20241022` | `sonnet` | 5MB | 200K | Enhanced reasoning, general use |
| `openai/o4-mini` | `o4-mini` | 20MB | 200K | Rapid reasoning, large images |
| `google/gemini-2.5-pro-preview` | `pro` | 16MB | 1M | Long documents, detailed analysis |
| `google/gemini-2.5-flash-preview-05-20` | `flash` | 16MB | 1M | Speed, cost-effective |
| `anthropic/claude-3-haiku` | `haiku` | 5MB | 200K | Fast, lightweight analysis |
| `mistralai/mistral-small-3.1` | - | 8MB | 96K | European model, GDPR compliance |

### Model Selection Guide

```bash
# Speed-optimized (fastest)
--model flash

# Quality-optimized (best analysis)
--model sonnet

# Large images (up to 20MB)
--model o4-mini

# Long context (documents with images)
--model meta-llama/llama-4-scout

# Cost-effective
--model haiku
```

## Usage Examples

### 1. Basic Image Analysis

```bash
# Analyze a single image
zenode:chat "Describe what you see in this image" \
  --images /Users/username/screenshots/app.png \
  --model anthropic/claude-3-sonnet
```

**Expected Output:**
```
I can see a screenshot of a web application interface. The image shows:

1. **Header Section**: A dark navigation bar with a logo on the left and user menu on the right
2. **Main Content**: A dashboard layout with several cards displaying metrics
3. **Sidebar**: A collapsible navigation menu with various options
4. **Color Scheme**: Primarily using blue and white with good contrast
5. **Layout**: Clean, modern design following material design principles

The interface appears to be a business analytics dashboard with real-time data visualization components.
```

### 2. Multiple Images Comparison

```bash
# Compare multiple images
zenode:analyze "Compare these UI mockups and suggest improvements" \
  --files /path/to/mockup1.png /path/to/mockup2.png \
  --model anthropic/claude-3-sonnet
```

### 3. Code Screenshot Analysis

```bash
# Analyze code screenshots for bugs
zenode:codereview "Review this code screenshot for potential issues" \
  --files /Users/username/Desktop/code-error.png \
  --model meta-llama/llama-4-maverick-17b-instruct \
  --focus-on "syntax errors, logic issues, best practices"
```

**Expected Output:**
```
## Code Review Results

### Issues Found:
1. **Line 15**: Missing semicolon at end of statement
2. **Line 23**: Potential null pointer exception - no null check before calling `.length`
3. **Line 31**: Inefficient loop - could use `Array.map()` instead

### Suggestions:
- Add TypeScript for better type safety
- Consider using async/await instead of promises
- Extract magic numbers into named constants

### Security Concerns:
- Line 42: Direct DOM manipulation without sanitization
```

### 4. Data URL Support

```bash
# Use base64 data URLs directly
zenode:chat "What's in this image?" \
  --images "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" \
  --model flash
```

### 5. OCR and Text Extraction

```bash
# Extract text from images
zenode:chat "Extract all text from this document image and format it as markdown" \
  --images /path/to/document.jpg \
  --model google/gemini-2.5-pro-preview
```

### 6. Technical Documentation Analysis

```bash
# Analyze architectural diagrams
zenode:thinkdeep "Analyze this system architecture diagram and identify potential bottlenecks" \
  --files /path/to/architecture.png \
  --model meta-llama/llama-4-scout \
  --thinking-mode high
```

### 7. UI/UX Review

```bash
# Design feedback
zenode:chat "Provide UX feedback on this mobile app interface" \
  --images /path/to/mobile-mockup.png \
  --model anthropic/claude-3-sonnet \
  --temperature 0.7
```

**Expected Output:**
```
## UX Analysis

### Strengths:
- Clear visual hierarchy with proper typography scaling
- Intuitive navigation patterns following platform conventions
- Good use of whitespace and visual breathing room
- Consistent color scheme and branding

### Areas for Improvement:
- CTA button could be more prominent (increase contrast)
- Touch targets appear small for accessibility (recommend 44px minimum)
- Consider reducing cognitive load by grouping related actions

### Accessibility Notes:
- Text contrast ratios look good
- Consider adding alt text descriptions for images
- Ensure proper focus indicators for keyboard navigation
```

## File Formats & Limits

### Supported Formats
- **JPEG/JPG**: High compression, photos
- **PNG**: Lossless, screenshots, graphics  
- **GIF**: Animations, simple graphics
- **WebP**: Modern format, good compression

### Size Limits by Provider

| Provider | Max Size | Notes |
|----------|----------|-------|
| OpenAI Models | 20MB | o3, o4, gpt-4o series |
| Claude Models | 5MB | All Claude 3+ models |
| Gemini Models | 16MB | 2.5 Pro/Flash series |
| Llama Models | 10-15MB | Depends on specific model |
| Mistral Models | 8MB | Small 3.1 with vision |

### Input Methods

```bash
# File paths (absolute recommended)
--images /absolute/path/to/image.png

# Multiple files
--images /path/img1.jpg /path/img2.png

# Data URLs
--images "data:image/jpeg;base64,/9j/4AAQSkZJRg..."

# Mixed formats
--images /path/screenshot.png "data:image/png;base64,iVBORw0KGgo..."
```

## Error Handling

### Common Errors and Solutions

#### 1. File Not Found
```bash
Error: Failed to access image file /path/to/image.png: ENOENT: no such file or directory
```
**Solution**: Use absolute paths and verify file exists:
```bash
ls -la /path/to/image.png
realpath /path/to/image.png
```

#### 2. Size Limit Exceeded
```bash
Error: Images exceed size limit: 25.3MB > 5MB
```
**Solution**: Use a model with higher limits or compress the image:
```bash
# Use OpenAI model (20MB limit)
--model openai/o4-mini

# Or compress the image first
convert input.png -quality 85 -resize 1920x1080> output.jpg
```

#### 3. Unsupported Format
```bash
Error: Unsupported image format: .bmp
```
**Solution**: Convert to supported format:
```bash
convert image.bmp image.png
```

#### 4. Invalid Base64
```bash
Error: Invalid base64 data in data URL
```
**Solution**: Verify data URL format:
```javascript
// Correct format
data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...

// Common mistake - missing image/ prefix
data:png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...
```

#### 5. Model Doesn't Support Images
```bash
Error: Model does not support image processing. Please use a vision-capable model.
```
**Solution**: Switch to a vision model:
```bash
# Check supported models
zenode:config list

# Use vision-capable model
--model anthropic/claude-3-sonnet
```

## Best Practices

### 1. Model Selection

```bash
# For speed and cost
--model flash

# For quality analysis  
--model sonnet

# For large images (>5MB)
--model openai/o4-mini

# For complex reasoning
--model meta-llama/llama-4-maverick-17b-instruct
```

### 2. Image Optimization

```bash
# Resize large images before upload
convert large-image.png -resize 1920x1080> optimized.png

# Compress JPEG quality
convert image.jpg -quality 85 compressed.jpg

# Convert to efficient format
convert image.bmp image.webp
```

### 3. Prompt Engineering

```bash
# Be specific about what you want
zenode:chat "Identify specific UI/UX issues in this mobile app screenshot, focusing on accessibility and usability" \
  --images app.png --model sonnet

# Rather than generic
zenode:chat "What do you see?" --images app.png --model sonnet
```

### 4. Batch Processing

```bash
# Process multiple images efficiently
for img in screenshots/*.png; do
  echo "Processing $img..."
  zenode:analyze "Identify any errors or issues in this interface" \
    --files "$img" --model haiku --output-format summary
done
```

### 5. Error Recovery

```bash
# Test image validation first
zenode:debug "Test image processing capabilities" \
  --files /path/to/test-image.png \
  --model flash \
  --runtime-info "Testing before batch processing"
```

## Troubleshooting

### Verify Image Support

```bash
# Test with a simple image
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" | base64 -d > test.png

zenode:chat "What color is this pixel?" \
  --images test.png \
  --model anthropic/claude-3-sonnet
```

### Debug Image Processing

```bash
# Enable debug logging
export DEBUG=zenode:image*

# Run with verbose output  
zenode:debug "Image processing test" \
  --files /path/to/image.png \
  --model sonnet \
  --runtime-info "Node $(node -v), OS $(uname -s)"
```

### Check Provider Status

```bash
# Verify OpenRouter connection
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" \
     -H "Content-Type: application/json" \
     https://openrouter.ai/api/v1/models | jq '.data[] | select(.id | contains("vision")) | .id'
```

### Model Capability Testing

```bash
# Test multiple models quickly
for model in flash sonnet haiku o4-mini; do
  echo "Testing $model..."
  zenode:chat "What's in this image?" \
    --images test.png \
    --model "$model" \
    --timeout 30s
done
```

## Advanced Usage

### Custom Model Configuration

Edit `zenode/conf/custom_models.json` to add new OpenRouter models:

```json
{
  "models": [
    {
      "model_name": "new-provider/vision-model",
      "aliases": ["new-vision", "nv"],
      "context_window": 100000,
      "supports_extended_thinking": false,
      "supports_json_mode": true,
      "supports_function_calling": true,
      "description": "New vision model via OpenRouter"
    }
  ]
}
```

### Programmatic Usage

```javascript
import { OpenRouterProvider } from './src/providers/openrouter.js';
import { validateImages } from './src/utils/image-utils.js';

const provider = new OpenRouterProvider(process.env.OPENROUTER_API_KEY);
const capabilities = await provider.getImageCapabilities('anthropic/claude-3-sonnet');
const validation = await validateImages(['/path/to/image.png'], capabilities);

if (validation.valid) {
  console.log('✅ Images validated successfully');
} else {
  console.log('❌ Validation failed:', validation.error);
}
```

### Integration with CI/CD

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression Testing

on: [push, pull_request]

jobs:
  visual-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install zenode
        run: npm install -g @zenode/mcp-server
        
      - name: Analyze UI screenshots
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: |
          zenode:analyze "Compare these screenshots for visual regressions" \
            --files screenshots/before.png screenshots/after.png \
            --model anthropic/claude-3-sonnet \
            --output-format actionable
```

---

## Quick Reference

### Essential Commands
```bash
# Basic analysis
zenode:chat "Describe this image" --images image.png --model sonnet

# Code review
zenode:codereview "Review this code" --files code.png --model o4-mini

# OCR extraction  
zenode:chat "Extract text" --images document.jpg --model pro

# Batch processing
zenode:analyze "Find issues" --files *.png --model haiku
```

### Model Quick Reference
- **Speed**: `flash` (Gemini 2.5 Flash)
- **Quality**: `sonnet` (Claude 3.5 Sonnet)  
- **Large files**: `o4-mini` (OpenAI O4 Mini)
- **Cost-effective**: `haiku` (Claude 3 Haiku)
- **Advanced**: `meta-llama/llama-4-maverick-17b-instruct`

### File Formats
- ✅ **Supported**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- ❌ **Not supported**: `.bmp`, `.tiff`, `.svg`, `.ico`

### Size Limits
- **OpenAI models**: 20MB
- **Claude models**: 5MB  
- **Gemini models**: 16MB
- **Llama models**: 10-15MB

---

*For more information, see the main [Zenode MCP Server documentation](../README.md) or visit [OpenRouter](https://openrouter.ai/docs) for API details.*