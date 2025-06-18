# Zenode Image Support Implementation Plan
## Porting Python Commit 97fa678 to Node.js

**Target Commit:** `97fa678` - Vision support via images/PDFs with processing pipeline, OpenAI GPT-4.1 support, and chat tool enhancement

**Status:** Planning Phase  
**Created:** 2025-06-17  
**Author:** Zenode Development Team  

---

## 🎯 Executive Summary

This document outlines the comprehensive plan to port the Python image support feature from commit `97fa678` to the Node.js zenode implementation. The feature enables vision capabilities across all AI tools, supporting PNG, JPEG, GIF, and WebP formats with model-specific size validation, conversation memory integration, and cross-tool image context preservation.

### Key Success Metrics
- ✅ **Functional Parity**: 100% feature equivalence with Python implementation
- ✅ **Type Safety**: Leverage TypeScript for robust image validation
- ✅ **Performance**: Node.js-optimized image processing pipeline
- ✅ **Integration**: Seamless integration with existing zenode architecture

---

## 📊 Python Implementation Analysis

### Core Components Identified

**1. File Type Infrastructure** (`utils/file_types.py`)
```python
# Python - Limited to AI model compatible formats
IMAGES = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", 
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}
```

**2. Tool Base Integration** (`tools/base.py`)
```python
class ToolRequest(BaseModel):
    images: Optional[list[str]] = Field(
        None,
        description="Optional image(s) for visual context..."
    )

def _validate_image_limits(self, images: Optional[list[str]], model_name: str) -> Optional[dict]:
    # Model-specific size validation with capability checking
    # O3: 20MB limit, provider-specific constraints
```

**3. Conversation Memory** (`utils/conversation_memory.py`)
```python
class ConversationTurn(BaseModel):
    images: Optional[list[str]] = None  # Images referenced in this turn

def get_conversation_image_list(context: ThreadContext) -> list[str]:
    # Newest-first prioritization identical to file handling
```

### Provider Capabilities Integration
- Enhanced provider capabilities with `supports_images` and `max_image_size_mb`
- Fallback to custom model configuration for capability detection
- Provider-specific routing for vision vs non-vision models

---

## 🏗️ Zenode Architecture Assessment

### Current Strengths
- **Strong Typing**: TypeScript provides superior type safety vs Python's dynamic typing
- **Zod Validation**: Runtime schema validation with compile-time inference
- **Redis Integration**: Robust conversation memory with file tracking
- **Provider Registry**: Flexible model capability system
- **File Utils**: Security-first file handling with token estimation

### Integration Points
1. **Base Tool** (`src/tools/base.ts`): ✅ Zod schemas, file handling utilities
2. **Conversation Memory** (`src/utils/conversation-memory.ts`): ✅ Redis-based with file tracking  
3. **Provider System** (`src/providers/`): ✅ Registry pattern with capabilities
4. **Types** (`src/types/`): ✅ Comprehensive TypeScript typing

---

## 🚀 Implementation Strategy

### Phase 1: Type System & Utilities (Week 1)

**1.1 Image Type Definitions** (`src/types/images.ts`)
```typescript
// Leverage TypeScript's literal types for compile-time safety
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const;
export type ImageExtension = typeof IMAGE_EXTENSIONS[number];

export const IMAGE_MIME_TYPES: Record<ImageExtension, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', 
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
} as const;

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  totalSize?: number;
  maxAllowed?: number;
}

export interface ImageCapabilities {
  supportsImages: boolean;
  maxImageSizeMB: number;
  supportedFormats: readonly ImageExtension[];
}
```

**1.2 Image Utilities** (`src/utils/image-utils.ts`)
```typescript
import { fileTypeFromBuffer } from 'file-type';
import { readFile, stat } from 'fs/promises';

/**
 * Validate image files with Node.js ecosystem advantages
 * Uses file-type library for robust MIME detection vs Python's extension-based approach
 */
export async function validateImages(
  imagePaths: string[], 
  modelCapabilities: ImageCapabilities
): Promise<ImageValidationResult> {
  // Superior to Python: Actual MIME type detection vs extension checking
  for (const path of imagePaths) {
    const buffer = await readFile(path);
    const fileType = await fileTypeFromBuffer(buffer);
    
    if (!fileType || !IMAGE_EXTENSIONS.includes(fileType.ext as ImageExtension)) {
      return { valid: false, error: `Unsupported image format: ${fileType?.ext}` };
    }
  }
  
  // Size validation with byte-accurate checking
  const totalSize = await calculateTotalImageSize(imagePaths);
  const maxBytes = modelCapabilities.maxImageSizeMB * 1024 * 1024;
  
  if (totalSize > maxBytes) {
    return { 
      valid: false, 
      error: `Images exceed size limit`,
      totalSize: totalSize / (1024 * 1024),
      maxAllowed: modelCapabilities.maxImageSizeMB
    };
  }
  
  return { valid: true };
}

/**
 * Handle data URLs with robust base64 validation
 * Node.js Buffer provides better base64 handling than Python
 */
export function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  
  try {
    const buffer = Buffer.from(match[2], 'base64');
    return { mimeType: match[1], buffer };
  } catch {
    return null;
  }
}
```

**1.3 Provider Capability Enhancement** (`src/types/providers.ts`)
```typescript
export interface ModelCapabilities {
  // Existing fields...
  supportsImages?: boolean;
  maxImageSizeMB?: number;
  supportedImageFormats?: readonly ImageExtension[];
}

// Update provider interface
export interface ModelProvider {
  // Existing methods...
  getImageCapabilities(modelName: string): Promise<ImageCapabilities>;
}
```

### Phase 2: Base Tool Integration (Week 2)

**2.1 Enhanced Base Request Schema** (`src/tools/base.ts`)
```typescript
import { z } from 'zod';

// Extend base request schema with images
export const BaseRequestSchema = z.object({
  // Existing fields...
  images: z.array(z.string()).optional().describe(
    "Optional image(s) for visual context. Accepts absolute file paths or " +
    "base64 data URLs. Useful for UI discussions, diagrams, visual problems, " +
    "error screens, architecture mockups, and visual analysis tasks."
  ),
});

// Update base tool class
export abstract class BaseTool {
  /**
   * Validate image limits at MCP boundary
   * TypeScript provides compile-time safety vs Python's runtime checks
   */
  protected async validateImageLimits(
    images: string[] | undefined,
    modelName: string
  ): Promise<ToolOutput | null> {
    if (!images?.length) return null;
    
    const provider = await this.getModelProvider(modelName);
    const capabilities = await provider.getImageCapabilities(modelName);
    
    if (!capabilities.supportsImages) {
      return this.formatOutput(
        `Model ${modelName} does not support image processing. ` +
        `Please use a vision-capable model or remove images from your request.`,
        'error'
      );
    }
    
    const validation = await validateImages(images, capabilities);
    if (!validation.valid) {
      return this.formatOutput(
        `Image validation failed: ${validation.error}`,
        'error'
      );
    }
    
    return null;
  }
}
```

**2.2 Tool Schema Integration**
```typescript
// All tools automatically inherit image support through BaseRequestSchema
// Example for ChatTool:
export class ChatTool extends BaseTool {
  getZodSchema() {
    return BaseRequestSchema.extend({
      prompt: z.string().describe("Your question..."),
      files: z.array(z.string()).optional(),
      // images inherited from BaseRequestSchema
    });
  }
}
```

### Phase 3: Conversation Memory Enhancement (Week 3)

**3.1 Enhanced Conversation Types** (`src/types/tools.ts`)
```typescript
export interface ConversationTurn {
  // Existing fields...
  images?: string[]; // Track images referenced in this turn
}

export interface ConversationThread {
  // Existing fields...  
  // No changes needed - images stored in individual turns
}
```

**3.2 Image List Functions** (`src/utils/conversation-memory.ts`)
```typescript
/**
 * Extract all unique images from conversation turns with newest-first prioritization
 * Identical algorithm to Python but with TypeScript type safety
 */
export function getConversationImageList(thread: ConversationThread): string[] {
  if (!thread.turns?.length) {
    logger.debug('[IMAGES] No turns found, returning empty image list');
    return [];
  }

  const seenImages = new Set<string>();
  const imageList: string[] = [];

  logger.debug(`[IMAGES] Collecting images from ${thread.turns.length} turns (newest first)`);

  // Process turns in reverse order (newest first) - identical to file prioritization
  for (let i = thread.turns.length - 1; i >= 0; i--) {
    const turn = thread.turns[i];
    if (turn?.images?.length) {
      logger.debug(`[IMAGES] Turn ${i + 1} has ${turn.images.length} images: ${turn.images.join(', ')}`);
      for (const imagePath of turn.images) {
        if (!seenImages.has(imagePath)) {
          seenImages.add(imagePath);
          imageList.push(imagePath);
          logger.debug(`[IMAGES] Added new image: ${imagePath} (from turn ${i + 1})`);
        } else {
          logger.debug(`[IMAGES] Skipping duplicate image: ${imagePath} (newer version already included)`);
        }
      }
    }
  }

  logger.debug(`[IMAGES] Final image list (${imageList.length}): ${imageList.join(', ')}`);
  return imageList;
}

/**
 * Enhanced conversation history building with image context
 */
export async function buildConversationHistory(
  thread: ConversationThread,
  modelContext: ModelContext,
): Promise<{ history: string; tokens: number }> {
  // Existing file handling logic...
  
  // Add image handling similar to files
  const allImages = getConversationImageList(thread);
  
  if (allImages.length > 0) {
    historyParts.push('=== IMAGES REFERENCED IN THIS CONVERSATION ===');
    historyParts.push('The following images have been shared during our conversation:');
    
    for (const imagePath of allImages) {
      historyParts.push(`- ${imagePath}`);
    }
    
    historyParts.push('');
    historyParts.push('=== END REFERENCED IMAGES ===');
  }
  
  // Rest of existing logic...
}
```

### Phase 4: Provider System Updates (Week 4)

**4.1 Provider Capability Implementation**
```typescript
// Update each provider to support image capabilities
export class OpenAIProvider extends BaseProvider {
  async getImageCapabilities(modelName: string): Promise<ImageCapabilities> {
    // OpenAI-specific logic
    if (modelName.includes('o3')) {
      return {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: IMAGE_EXTENSIONS,
      };
    }
    
    if (modelName.includes('gpt-4')) {
      return {
        supportsImages: true,
        maxImageSizeMB: 20,
        supportedFormats: IMAGE_EXTENSIONS,
      };
    }
    
    return { supportsImages: false, maxImageSizeMB: 0, supportedFormats: [] };
  }
}

export class GeminiProvider extends BaseProvider {
  async getImageCapabilities(modelName: string): Promise<ImageCapabilities> {
    // Gemini vision models support
    const visionModels = ['gemini-pro-vision', 'gemini-2.5-pro-preview-06-05'];
    
    if (visionModels.some(model => modelName.includes(model))) {
      return {
        supportsImages: true,
        maxImageSizeMB: 16, // Gemini specific limit
        supportedFormats: IMAGE_EXTENSIONS,
      };
    }
    
    return { supportsImages: false, maxImageSizeMB: 0, supportedFormats: [] };
  }
}
```

---

## 🔧 Node.js Ecosystem Advantages

### Superior Libraries Over Python Equivalents

**Image Processing:**
```typescript
// Node.js: file-type library for robust MIME detection
import { fileTypeFromBuffer } from 'file-type';
const fileType = await fileTypeFromBuffer(buffer);

// vs Python: Extension-based detection
// extension = Path(file_path).suffix.lower()
```

**Memory Management:**
```typescript
// Node.js: Efficient Buffer handling for image data  
const buffer = Buffer.from(base64Data, 'base64');
const stream = require('stream');

// vs Python: String-based base64 handling with higher memory overhead
```

**Async Processing:**
```typescript
// Node.js: Native async/await with streams
import { pipeline } from 'stream/promises';
await pipeline(imageStream, processStream, outputStream);

// vs Python: asyncio overhead for I/O operations
```

### TypeScript Type Safety Advantages

**1. Compile-Time Validation:**
```typescript
// TypeScript: Catch errors at compile time
const images: ImageExtension[] = ['.png', '.invalid']; // ❌ Compile error

// vs Python: Runtime errors only
images = [".png", ".invalid"]  # ✅ No error until runtime
```

**2. IDE Intelligence:**
```typescript
// TypeScript: Full autocomplete and refactoring support
interface ImageRequest {
  images: string[];
  model: string;
}
// IDE provides complete type information

// vs Python: Limited type hints, runtime discovery
```

**3. Discriminated Unions:**
```typescript
// TypeScript: Precise error handling
type ValidationResult = 
  | { success: true; images: ProcessedImage[] }
  | { success: false; error: string; details: ErrorDetails };

// vs Python: Dict-based return values with potential key errors
```

---

## 🧪 Testing Strategy

### Comprehensive Test Coverage

**1. Unit Tests** (`src/utils/__tests__/image-utils.test.ts`)
```typescript
describe('Image Validation', () => {
  test('validates supported formats with real MIME detection', async () => {
    const tempPng = await createTestImage('png');
    const result = await validateImages([tempPng], mockCapabilities);
    expect(result.valid).toBe(true);
  });
  
  test('rejects oversized images', async () => {
    const largePng = await createLargeTestImage(25 * 1024 * 1024); // 25MB
    const capabilities = { maxImageSizeMB: 20, supportsImages: true };
    const result = await validateImages([largePng], capabilities);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceed size limit');
  });
  
  test('handles data URLs correctly', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = parseDataUrl(dataUrl);
    expect(result).not.toBeNull();
    expect(result?.mimeType).toBe('image/png');
  });
});
```

**2. Integration Tests** (`src/__tests__/image-integration.test.ts`)
```typescript
describe('Image Support Integration', () => {
  test('chat tool processes images with provider validation', async () => {
    const tool = new ChatTool();
    const args = {
      prompt: 'What do you see in this image?',
      images: ['/path/to/test.png'],
      model: 'gpt-4o'
    };
    
    // Mock provider to return vision capabilities
    mockProvider.getImageCapabilities.mockResolvedValue({
      supportsImages: true,
      maxImageSizeMB: 20
    });
    
    const result = await tool.execute(args);
    expect(result.status).toBe('success');
  });
});
```

**3. Conversation Memory Tests**
```typescript
describe('Image Memory Integration', () => {
  test('newest-first image prioritization', () => {
    const thread = createTestThread([
      { role: 'user', content: 'Turn 1', images: ['old.png', 'shared.png'] },
      { role: 'user', content: 'Turn 2', images: ['new.png', 'shared.png'] },
    ]);
    
    const imageList = getConversationImageList(thread);
    expect(imageList).toEqual(['new.png', 'shared.png', 'old.png']);
  });
});
```

---

## 📦 Package Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "file-type": "^19.0.0",     // MIME type detection
    "sharp": "^0.33.0",         // Image processing (if needed)
    "image-size": "^1.1.1"      // Dimension extraction
  },
  "devDependencies": {
    "@types/sharp": "^0.32.0"
  }
}
```

### Rationale for Library Choices

**file-type vs Python's pathlib:**
- ✅ Actual content analysis vs extension checking
- ✅ Handles corrupted/renamed files correctly
- ✅ Supports data URLs and streams

**Sharp (optional):**
- ✅ High-performance image processing
- ✅ Memory-efficient for large images
- ✅ Only include if image transformations needed

---

## 🔒 Security Considerations

### Enhanced Security vs Python Implementation

**1. Path Traversal Protection:**
```typescript
// Node.js: Robust path validation with path.resolve
import { resolve, isAbsolute } from 'path';

function validateImagePath(imagePath: string): boolean {
  const resolved = resolve(imagePath);
  return isAbsolute(resolved) && resolved.startsWith(WORKSPACE_ROOT);
}
```

**2. MIME Type Validation:**
```typescript
// Node.js: Content-based validation vs extension checking
const fileType = await fileTypeFromBuffer(buffer);
if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
  throw new Error('Invalid image format');
}
```

**3. Size Limits:**
```typescript
// Node.js: Stream-based size checking to prevent memory attacks
import { createReadStream } from 'fs';

async function validateFileSize(path: string, maxBytes: number): Promise<boolean> {
  const stream = createReadStream(path);
  let totalSize = 0;
  
  for await (const chunk of stream) {
    totalSize += chunk.length;
    if (totalSize > maxBytes) {
      stream.destroy();
      return false;
    }
  }
  
  return true;
}
```

---

## 📋 README.md Updates Required

### Zenode Section Enhancements

**Add to Features Section:**
```markdown
## ✨ Key Features

### 🖼️ **Vision & Image Support**
- **Universal Image Support**: All tools accept images for visual context
- **Smart Format Detection**: PNG, JPEG, GIF, WebP with content validation  
- **Model-Aware Limits**: Automatic size validation per AI model capabilities
- **Cross-Tool Context**: Images preserved across conversation turns
- **Data URL Support**: Base64 encoded images for inline processing
- **Security First**: Path validation and content verification

### Example Usage:
```bash
# Analyze UI screenshots
claude chat --images screenshot.png "What UX improvements would you suggest?"

# Debug with error screens  
claude debug --images error_dialog.png --files error.log "Help diagnose this issue"

# Code review with architectural diagrams
claude codereview --images architecture.png --files src/ "Review this implementation"
```

**Add to Configuration Section:**
```markdown
### 🔧 Image Configuration

Image support is automatically enabled for vision-capable models:

- **OpenAI Models**: GPT-4o, O3 series (20MB limit)
- **Gemini Models**: Pro Vision variants (16MB limit)  
- **Custom Models**: Configure via `custom_models.json`

```json
{
  "models": [{
    "model_name": "my-vision-model",
    "supports_images": true,
    "max_image_size_mb": 25
  }]
}
```

**Environment Variables:**
- No additional configuration required
- Uses existing model provider settings
- Automatically detects vision capabilities
```

---

## ⚠️ Risk Mitigation

### Identified Risks & Mitigation Strategies

**1. Memory Usage with Large Images**
- **Risk**: Node.js heap exhaustion with multiple large images
- **Mitigation**: Stream-based processing, size pre-validation, per-request limits

**2. Provider API Changes**
- **Risk**: Vision API changes breaking compatibility  
- **Mitigation**: Capability-based routing, graceful degradation, comprehensive testing

**3. Security Vulnerabilities**
- **Risk**: Path traversal, malicious images, DoS attacks
- **Mitigation**: Path validation, content verification, size limits, timeouts

**4. Cross-Platform Compatibility**
- **Risk**: Different image handling across OS platforms
- **Mitigation**: Use cross-platform libraries (file-type), comprehensive CI testing

---

## 📅 Implementation Timeline

### Week 1: Foundation (Dec 18-22)
- [ ] Image type definitions and utilities
- [ ] Basic validation functions  
- [ ] Unit tests for core functionality

### Week 2: Tool Integration (Dec 25-29)
- [ ] Base tool image validation
- [ ] Schema updates for all tools
- [ ] Integration tests

### Week 3: Memory & Context (Jan 1-5)
- [ ] Conversation memory enhancements
- [ ] Image list prioritization
- [ ] Cross-tool context preservation

### Week 4: Providers & Polish (Jan 8-12)
- [ ] Provider capability implementation
- [ ] Comprehensive integration testing
- [ ] Documentation and README updates

### Week 5: Testing & Deployment (Jan 15-19)
- [ ] End-to-end testing with real providers
- [ ] Performance optimization
- [ ] Security audit and validation

---

## ✅ Acceptance Criteria

### Functional Requirements
- [ ] **API Parity**: All Python image features work identically in Node.js
- [ ] **Type Safety**: Full TypeScript coverage with strict typing
- [ ] **Provider Support**: OpenAI, Gemini, and custom models handle images correctly
- [ ] **Memory Management**: No memory leaks or excessive usage with large images
- [ ] **Security**: All identified security concerns addressed

### Quality Requirements  
- [ ] **Test Coverage**: >95% coverage for image-related code
- [ ] **Performance**: Image processing <2s for typical use cases
- [ ] **Documentation**: Complete API documentation and examples
- [ ] **Error Handling**: Graceful degradation for unsupported scenarios

### Integration Requirements
- [ ] **Conversation Memory**: Images tracked across tool boundaries
- [ ] **Provider Registry**: Dynamic capability detection working
- [ ] **Cross-Tool Support**: All 11 tools support images appropriately  
- [ ] **Backward Compatibility**: Existing functionality unaffected

---

## 🔍 Success Validation

### Testing Scenarios

**1. Basic Image Support:**
```bash
# Test each tool with images
claude chat --images ui.png "Analyze this interface"
claude debug --images error.png "What's wrong here?"
claude analyze --images diagram.png "Explain this architecture"
```

**2. Conversation Continuity:**
```bash
# Verify images preserved across turns
claude chat --images design.png "Review this design" 
# Continue with follow-up (images should be referenced)
claude chat --continuation-id=abc123 "Make it more accessible"
```

**3. Size Limit Validation:**
```bash
# Test with oversized image (should fail gracefully)
claude chat --images large_25mb.png "Process this" # Should error
```

**4. Provider Switching:**
```bash
# Test different models handle images correctly
claude chat --model=gpt-4o --images test.png "Describe this"
claude chat --model=gemini-pro-vision --images test.png "Describe this"
```

---

This plan provides a comprehensive roadmap for implementing image support in zenode while leveraging TypeScript's type safety and Node.js ecosystem advantages. The phased approach ensures systematic development with proper testing and validation at each stage.