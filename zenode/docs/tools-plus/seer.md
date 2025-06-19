# Seer Tool - Dedicated Vision & Image Analysis

**🔮 DEDICATED VISION TOOL for all image analysis tasks**

The `zenode:seer` tool is zenode's specialized vision and image analysis system. Often used with `zenode:visit` to search for for images online and also provide digital cultural context.

## Key Features

- **Dedicated vision model selection** - Automatically chooses the best vision-capable model
- **Container file access** - Seamless integration with zenode's Docker workspace
- **Multiple analysis types** - From basic description to professional quality assessment
- **High-capacity image support** - Handles up to 20MB images via OpenRouter/OpenAI
- **Comprehensive format support** - PNG, JPG, JPEG, GIF, WebP, and more
- **Focus area analysis** - Targeted analysis of specific image aspects
- **Professional assessment** - Business-ready image evaluation

## Tool Parameters

- `prompt`: Description of what you want to analyze or understand (required)
- `images`: Array of absolute image paths (required, use `/workspace/` paths)
- `analysis_type`: description|technical|professional|detailed|comparison (default: detailed)
- `focus_areas`: Array of specific aspects to focus on (optional)
- `model`: Vision model override (default: auto-selects best vision model)
- `temperature`: Response creativity (0-1, default 0.3 for consistent analysis)
- `thinking_mode`: Depth of analysis (minimal|low|medium|high|max)
- `use_websearch`: Enable web search for context (default: true)
- `continuation_id`: Continue previous analysis conversations

## Analysis Types

### `description` - Basic Image Description
Quick, factual description of image contents:
```bash
zenode:seer "What do you see in this image?" \
  --images ["/workspace/photos/scene.jpg"] \
  --analysis-type description
```

### `technical` - Technical Quality Assessment
Focuses on technical aspects like resolution, composition, quality:
```bash
zenode:seer "Assess the technical quality of this photograph" \
  --images ["/workspace/photos/product.jpg"] \
  --analysis-type technical
```

### `professional` - Business/Professional Evaluation
Evaluates suitability for business use, branding, professional contexts:
```bash
zenode:seer "Is this image suitable for our company website?" \
  --images ["/workspace/marketing/headshot.jpg"] \
  --analysis-type professional
```

### `detailed` - Comprehensive Analysis
In-depth analysis covering all aspects:
```bash
zenode:seer "Provide comprehensive analysis of this UI design" \
  --images ["/workspace/designs/mockup.png"] \
  --analysis-type detailed
```

### `comparison` - Multi-Image Comparison
Compare multiple images side by side:
```bash
zenode:seer "Compare these two design options" \
  --images ["/workspace/designs/option-a.png", "/workspace/designs/option-b.png"] \
  --analysis-type comparison
```

## Focus Areas

Specify particular aspects to emphasize in analysis:

### UI/UX Focus
```bash
zenode:seer "Analyze this interface design" \
  --images ["/workspace/ui/dashboard.png"] \
  --focus-areas ["usability", "accessibility", "visual-hierarchy"]
```

### Photography Focus
```bash
zenode:seer "Evaluate this product photo" \
  --images ["/workspace/photos/product.jpg"] \
  --focus-areas ["lighting", "composition", "color-accuracy"]
```

### Technical Focus
```bash
zenode:seer "Review this technical diagram" \
  --images ["/workspace/docs/architecture.png"] \
  --focus-areas ["clarity", "accuracy", "completeness"]
```

## Usage Examples

### Basic Image Analysis
```bash
zenode:seer "What's happening in this screenshot?" \
  --images ["/workspace/screenshots/error.png"]
```

### UI/UX Review
```bash
zenode:seer "Review this mobile app design for usability issues" \
  --images ["/workspace/designs/mobile-app.png"] \
  --analysis-type detailed \
  --focus-areas ["user-experience", "accessibility", "mobile-optimization"]
```

### Professional Photo Assessment
```bash
zenode:seer "Evaluate if this headshot is suitable for LinkedIn" \
  --images ["/workspace/photos/headshot.jpg"] \
  --analysis-type professional
```

### Technical Documentation Review
```bash
zenode:seer "Analyze this system architecture diagram for clarity and completeness" \
  --images ["/workspace/docs/system-diagram.png"] \
  --analysis-type technical \
  --focus-areas ["accuracy", "clarity", "completeness"]
```

### Multi-Image Comparison
```bash
zenode:seer "Compare these before/after design iterations" \
  --images ["/workspace/designs/before.png", "/workspace/designs/after.png"] \
  --analysis-type comparison
```

### Error Analysis
```bash
zenode:seer "What error is shown in this application screenshot?" \
  --images ["/workspace/debugging/error-state.png"] \
  --focus-areas ["error-messages", "UI-state", "user-guidance"]
```

## Zenode-Specific Features

### Automatic Vision Model Selection
Zenode:seer automatically selects the best vision model based on:
- Image complexity and size
- Analysis type requested
- Available providers (OpenAI, OpenRouter, Gemini)
- Current model performance metrics

Default vision model priority:
1. `openai/gpt-4o` - Superior multimodal capabilities
2. `google/gemini-2.5-pro-preview` - High-capacity vision analysis
3. `anthropic/claude-3-sonnet` - Excellent for technical diagrams
4. `meta-llama/llama-4-maverick-17b-instruct` - Advanced reasoning

### Container File Access
Zenode:seer seamlessly handles Docker container file paths:
```bash
# Your local path: /Users/you/project/images/photo.jpg
# Container path: /workspace/project/images/photo.jpg
zenode:seer "analyze this" --images ["/workspace/project/images/photo.jpg"]
```

### Integration with Other Zenode Tools
```bash
# Coordinate analysis across multiple tools
:z "coordinate with zenode:seer and zenode:chat to analyze this UI mockup and suggest improvements"

# Follow up seer analysis with code review
zenode:seer "analyze this UI" --images ["/workspace/design.png"]
# Then: zenode:codereview --files ["/workspace/components/UI.tsx"] --continuation-id {seer_id}
```

### High-Resolution Support
- **Maximum image size**: 20MB (via OpenAI/OpenRouter)
- **Supported formats**: PNG, JPG, JPEG, GIF, WebP, BMP, TIFF
- **Multiple images**: Up to 10 images per analysis
- **Batch processing**: Compare and analyze multiple images simultaneously

## Advanced Usage Patterns

### Design System Analysis
```bash
# Analyze consistency across design components
zenode:seer "Analyze design consistency across these components" \
  --images ["/workspace/design-system/button.png", "/workspace/design-system/card.png", "/workspace/design-system/modal.png"] \
  --analysis-type detailed \
  --focus-areas ["consistency", "brand-alignment", "component-hierarchy"]
```

### A/B Testing Visual Analysis
```bash
# Compare A/B test variations
zenode:seer "Which design performs better for user engagement?" \
  --images ["/workspace/ab-test/variant-a.png", "/workspace/ab-test/variant-b.png"] \
  --analysis-type comparison \
  --focus-areas ["user-engagement", "visual-appeal", "conversion-optimization"]
```

### Accessibility Audit
```bash
zenode:seer "Audit this interface for accessibility issues" \
  --images ["/workspace/app/dashboard.png"] \
  --analysis-type professional \
  --focus-areas ["color-contrast", "text-readability", "navigation-clarity", "visual-hierarchy"]
```

### Brand Compliance Check
```bash
zenode:seer "Check if this marketing material complies with our brand guidelines" \
  --images ["/workspace/marketing/banner.png"] \
  --analysis-type professional \
  --focus-areas ["brand-consistency", "logo-usage", "color-compliance", "typography"]
```

## Configuration

### Environment Variables
```bash
# Vision model preference (optional)
DEFAULT_VISION_MODEL=openai/gpt-4o

# Provider API keys (at least one required)
OPENAI_API_KEY=your_key_here
OPENROUTER_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

### Docker Volume Mounting
Ensure images are accessible via workspace mounting:
```yaml
# zenode/docker-compose.yml
volumes:
  - ${HOME}:/workspace:rw  # Maps your home directory to /workspace
```

## Best Practices

### Path Management
- **Always use `/workspace/` paths** for images in zenode containers
- **Verify file exists**: Use `zenode:gopher --action file_exists --path "/workspace/image.jpg"`
- **Organize by purpose**: Keep UI mockups, photos, diagrams in separate folders

### Analysis Optimization
- **Choose appropriate analysis type** for your use case
- **Use focus areas** to get targeted insights
- **Batch related images** for comparison analysis
- **Continue conversations** to build on previous analysis

### Integration Strategies
- **Combine with zenode:chat** for discussion of analysis results
- **Use with zenode:codereview** for UI implementation validation
- **Coordinate with zenode:visit** for design trend research
- **Follow up with zenode:thinkdeep** for deeper design philosophy discussion

## Troubleshooting

### Common Issues
**Image not found:**
```bash
# Check file exists
zenode:gopher --action file_exists --path "/workspace/your/image.png"

# List directory contents
zenode:gopher --action list_directory --path "/workspace/your"
```

**Vision model errors:**
```bash
# Check zenode status and available providers
zenode:version

# Verify API keys are configured
docker-compose logs zenode-server | grep -i "vision\|provider"
```

**Large image failures:**
- Ensure images are under 20MB
- Try converting to more efficient formats (WebP, optimized JPEG)
- Use image compression tools before analysis

### Performance Tips
- **Optimize image sizes** for faster analysis
- **Use appropriate analysis types** - avoid detailed for simple descriptions
- **Batch similar analyses** to maintain context
- **Leverage conversation threading** to build complex analyses

## Comparison with Python Implementation

Zenode:seer advantages over Python zen:
- **Automatic vision model selection** vs manual model specification
- **Container-native file access** vs local file system dependencies
- **Multi-provider fallback** vs single provider limitation
- **Type-safe configuration** vs runtime configuration errors
- **Docker-ready deployment** vs local Python environment setup

The zenode:seer tool represents a significant advancement in AI-powered image analysis, combining the best vision models with zenode's robust container architecture.