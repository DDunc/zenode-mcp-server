# Visit Tool - Web Browsing & Search

**Comprehensive web browsing, search, and reverse image search capabilities**

The `zenode:visit` tool provides advanced web research capabilities through multiple optional APIs. It supports browser automation, multi-engine search, and reverse image search with graceful degradation when APIs are unavailable. Perfect for research, competitive analysis, and content discovery.

## Key Features

- **Browser automation** via Browserbase for interactive web browsing
- **Multi-engine search** via SearchAPI (Google, Bing, YouTube, Amazon)
- **Google search integration** via SerpAPI with reverse image search
- **Screenshot capture** of web pages for visual analysis
- **Location-based search** for geo-targeted results
- **Graceful API degradation** - works without API keys with helpful guidance
- **Container-native** operation within zenode's Docker environment
- **Integration ready** for use with other zenode tools

## Tool Parameters

- `action`: browse|search|reverse_image_search|screenshot (optional, auto-detects from context)
- `url`: URL to visit or image URL for reverse search
- `query`: Search query for web search
- `engine`: google|bing|youtube|auto (default: auto)
- `location`: Geographic location for search results (e.g., "United States", "Tokyo, Japan")
- `take_screenshot`: Whether to capture a screenshot of visited pages

## API Configuration

The visit tool supports three optional APIs that enhance its capabilities:

### SerpAPI (Google Search & Reverse Image Search)
**Configuration:**
```env
SERPAPI_KEY=your_serpapi_key_here
```

**Capabilities:**
- Real-time Google search results with 99.95% SLA
- Google Images reverse search
- Knowledge Graph data extraction
- Location-based search results
- Automatic CAPTCHA solving
- 100 free searches/month

### SearchAPI (Multi-Engine Search)
**Configuration:**
```env
SEARCHAPI_KEY=your_searchapi_key_here
```

**Capabilities:**
- Multi-engine support (Google, Bing, YouTube, Amazon)
- Sub-2 second response times
- 99.9% success rate with advanced CAPTCHA solving
- Geo-targeting with coordinate-level precision
- Pay-per-successful-search model

### Browserbase (Browser Automation)
**Configuration:**
```env
BROWSERBASE_API_KEY=your_browserbase_key_here
```

**Capabilities:**
- Scalable browser automation (1000s of browsers)
- Full Playwright/Puppeteer support
- SOC-2 Type 1 and HIPAA compliant
- Live view and session recording
- Global infrastructure with 4 vCPUs per browser

## Usage Examples

### Basic Web Search
```bash
zenode:visit "latest TypeScript features 2025" --action search --engine google
```

### Reverse Image Search
```bash
zenode:visit --action reverse_image_search --url "https://example.com/image.jpg"
```

### Browser Automation with Screenshots
```bash
zenode:visit "https://github.com/microsoft/TypeScript" --action browse --take-screenshot true
```

### Location-Based Search
```bash
zenode:visit "best Node.js conferences" --action search --location "San Francisco, CA" --engine google
```

### YouTube Content Discovery
```bash
zenode:visit "TypeScript tutorial 2025" --action search --engine youtube
```

### Competitive Analysis
```bash
zenode:visit "https://competitor.com/pricing" --action browse --take-screenshot true
```

### Documentation Research
```bash
zenode:visit "Docker best practices production deployment" --action search --engine google --location "United States"
```

## Zenode-Specific Features

### Container Integration
The visit tool operates within zenode's Docker environment:
- **Network access**: Full internet connectivity from containers
- **Screenshot storage**: Images saved to `/workspace/` for analysis
- **API key management**: Secure environment variable handling
- **Service discovery**: Integration with other zenode tools

### Multi-Tool Coordination
```bash
# Search for images and analyze them
zenode:visit "React component design patterns" --action search --engine google
# Then: zenode:seer "analyze these UI patterns" --images [found_images]

# Research and then implement
zenode:visit "TypeScript generic constraints best practices" --action search
# Then: zenode:codereview "review our generic usage" --files ["/workspace/src/types"]
```

### Automatic API Selection
Zenode:visit intelligently selects the best API based on:
- **Task requirements**: Search vs browsing vs reverse image search
- **API availability**: Graceful fallback when keys are missing
- **Performance needs**: Fast search vs comprehensive browsing
- **Cost optimization**: Free tiers vs paid APIs

## Advanced Usage Patterns

### Technical Research Workflow
```bash
# Step 1: Search for latest information
zenode:visit "Node.js 20 new features performance" --action search --engine google

# Step 2: Browse specific documentation
zenode:visit "https://nodejs.org/en/blog/announcements/v20-release-announce" --action browse --take-screenshot true

# Step 3: Analyze findings with other tools
zenode:analyze "impact of Node.js 20 features on our codebase" --files ["/workspace/package.json"]
```

### Competitive Intelligence
```bash
# Browse competitor sites with screenshots
zenode:visit "https://competitor.com/features" --action browse --take-screenshot true

# Search for reviews and analysis
zenode:visit "competitor.com review comparison" --action search --location "United States"

# Analyze findings
zenode:thinkdeep "competitive analysis based on research findings"
```

### Design Research
```bash
# Search for design inspiration
zenode:visit "modern dashboard UI design 2025" --action search --engine google

# Reverse search existing designs
zenode:visit --action reverse_image_search --url "/workspace/designs/current-dashboard.png"

# Visual analysis of findings
zenode:seer "analyze these dashboard designs for modern UI trends" --images [found_images]
```

### Technology Evaluation
```bash
# Research new frameworks
zenode:visit "SvelteKit vs Next.js 2025 comparison" --action search --engine google

# Browse official documentation
zenode:visit "https://kit.svelte.dev/docs/introduction" --action browse

# Search for community opinions
zenode:visit "SvelteKit production experience" --action search --engine google

# Synthesize findings
zenode:consensus "framework choice decision" --models '[
  {"model": "pro", "stance": "for", "stance_prompt": "Advocate for SvelteKit based on research"},
  {"model": "o3", "stance": "for", "stance_prompt": "Advocate for Next.js based on research"}
]'
```

### Security Research
```bash
# Search for vulnerability information
zenode:visit "TypeScript security vulnerabilities 2025" --action search --location "United States"

# Research specific CVEs
zenode:visit "https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2024-XXXX" --action browse

# Code security analysis
zenode:codereview "security review based on latest vulnerability research" --files ["/workspace/src"] --review-type security
```

## API-Specific Features

### With SerpAPI
- **Knowledge Graph extraction**: Rich structured data from Google
- **Image search results**: Multiple sizes and sources
- **Shopping results**: Product comparisons and prices
- **News integration**: Latest articles and press coverage
- **Academic search**: Scholar results for research papers

### With SearchAPI
- **Multi-engine comparison**: Compare results across search engines
- **YouTube integration**: Video content discovery with metadata
- **Amazon search**: Product research and pricing
- **Bing features**: Alternative search perspectives
- **Real-time data**: Sub-2 second fresh results

### With Browserbase
- **Interactive browsing**: Click buttons, fill forms, navigate
- **JavaScript execution**: Full dynamic content access
- **Session persistence**: Maintain login state across requests
- **File downloads**: Capture documents and resources
- **Mobile simulation**: Test responsive designs

## Error Handling and Fallbacks

### When APIs are Not Configured
The tool provides helpful guidance:
```bash
# Without API keys
zenode:visit "TypeScript documentation" --action search

# Returns setup instructions:
# "SerpAPI not configured. To enable Google search:
# 1. Sign up at https://serpapi.com
# 2. Set SERPAPI_KEY in your .env file
# 3. Restart zenode containers
# 
# Alternative: Use direct URL browsing or configure SearchAPI"
```

### API Rate Limits
- **Automatic retry**: Exponential backoff for temporary failures
- **Fallback providers**: Switch to alternative APIs when available
- **Usage tracking**: Monitor API consumption and costs
- **Error reporting**: Clear explanations of limitations

## Integration Patterns

### Research and Analysis Pipeline
```bash
:z "coordinate with zenode:visit, zenode:seer, and zenode:thinkdeep to research modern authentication patterns and analyze their implementation in our codebase"
```

### Content Discovery and Review
```bash
# Discover content
zenode:visit "React testing best practices 2025" --action search

# Analyze visual content
zenode:seer "analyze these testing pattern diagrams" --images [discovered_images]

# Apply to codebase
zenode:testgen "generate tests using discovered best practices" --files ["/workspace/src/components"]
```

### Documentation Enhancement
```bash
# Research current practices
zenode:visit "API documentation examples TypeScript" --action search

# Browse exemplary docs
zenode:visit "https://docs.stripe.com/api" --action browse --take-screenshot true

# Improve our docs
zenode:chat "enhance our API documentation based on research findings" --files ["/workspace/docs/api"]
```

## Best Practices

### Efficient API Usage
- **Batch related searches**: Group similar queries to minimize API calls
- **Use specific queries**: More targeted searches yield better results
- **Leverage location targeting**: Get relevant regional results
- **Cache results**: Store findings for repeated analysis

### Security Considerations
- **API key protection**: Store securely in environment variables
- **Rate limit awareness**: Monitor usage to avoid overages
- **Content validation**: Verify authenticity of search results
- **Privacy compliance**: Respect website terms of service

### Performance Optimization
- **Selective screenshots**: Only capture when needed for analysis
- **Concurrent searches**: Use multiple engines for comprehensive results
- **Result filtering**: Focus on relevant content for analysis
- **API selection**: Choose fastest appropriate service

## When to Use Visit vs Other Zenode Tools

- **Use `zenode:visit`** for: Web research, content discovery, reverse image search, competitive analysis
- **Use `zenode:seer`** for: Analyzing images found during research
- **Use `zenode:analyze`** for: Code analysis based on research findings
- **Use `zenode:chat`** for: Discussing and synthesizing research results

## Configuration

Update your zenode `.env` file:
```env
# Optional API keys (enhance capabilities when configured)
SERPAPI_KEY=your_serpapi_key_here
SEARCHAPI_KEY=your_searchapi_key_here  
BROWSERBASE_API_KEY=your_browserbase_key_here
```

Restart zenode containers:
```bash
cd zenode && docker-compose restart
```

The zenode:visit tool provides enterprise-grade web research capabilities, seamlessly integrating with zenode's ecosystem to enhance your development and analysis workflows.