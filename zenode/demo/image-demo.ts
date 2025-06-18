#!/usr/bin/env node
/**
 * Image Support Demonstration Script
 * 
 * This script demonstrates the complete image support pipeline:
 * 1. Fetches a remote image
 * 2. Converts it to data URL format
 * 3. Validates through our image system
 * 4. Tests provider capabilities
 * 5. Saves processed output to local folder
 */

import { promises as fs } from 'fs';
import { resolve, join } from 'path';
import https from 'https';
import { 
  validateImages, 
  getImageMetadata,
  parseDataUrl,
  calculateTotalImageSize,
} from '../src/utils/image-utils.js';
import { OpenAIProvider } from '../src/providers/openai.js';
import { GeminiProvider } from '../src/providers/gemini.js';
import { 
  isValidImageExtension, 
  getImageExtension, 
  isDataUrl,
} from '../src/types/images.js';

// Demo configuration - using a simple, direct image URL
const DEMO_IMAGE_URL = 'https://httpbin.org/image/png'; // Simple test image from httpbin
const OUTPUT_DIR = resolve('./demo-output');
const DEMO_TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Fetch image from URL and convert to data URL
 */
async function fetchImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log(`📥 Fetching image from: ${url}`);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.log(`↩️  Following redirect to: ${redirectUrl}`);
          fetchImageAsDataUrl(redirectUrl).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const chunks: Buffer[] = [];
      
      response.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        const contentType = response.headers['content-type'] || 'image/png';
        const dataUrl = `data:${contentType};base64,${base64}`;
        
        console.log(`✅ Image fetched: ${buffer.length} bytes, ${contentType}`);
        resolve(dataUrl);
      });
      
      response.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Save file to output directory
 */
async function saveToOutput(filename: string, content: string): Promise<string> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = join(OUTPUT_DIR, filename);
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
}

/**
 * Save binary data to output directory
 */
async function saveBinaryToOutput(filename: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = join(OUTPUT_DIR, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Main demonstration function
 */
async function runImageDemo(): Promise<void> {
  console.log('🚀 Starting Image Support Demonstration');
  console.log('=======================================\n');
  
  try {
    // Step 1: Fetch remote image
    const dataUrl = await fetchImageAsDataUrl(DEMO_IMAGE_URL);
    console.log(`📊 Data URL length: ${dataUrl.length} characters\n`);
    
    // Step 2: Test image type system
    console.log('🔍 Testing Image Type System:');
    console.log(`- Is data URL: ${isDataUrl(dataUrl)}`);
    console.log(`- Extension from path: ${getImageExtension('test.jpg')}`);
    console.log(`- Valid .png extension: ${isValidImageExtension('.png')}`);
    console.log(`- Invalid .txt extension: ${isValidImageExtension('.txt')}\n`);
    
    // Step 3: Parse and validate image metadata
    console.log('📋 Parsing Image Metadata:');
    const metadata = await getImageMetadata(dataUrl);
    console.log(`- Path: ${metadata.path.substring(0, 50)}...`);
    console.log(`- Size: ${metadata.sizeBytes} bytes (${(metadata.sizeBytes / 1024).toFixed(1)} KB)`);
    console.log(`- Extension: ${metadata.extension}`);
    console.log(`- Is Data URL: ${metadata.isDataUrl}\n`);
    
    // Step 4: Test provider capabilities
    console.log('🔧 Testing Provider Capabilities:');
    
    // OpenAI Provider
    const openaiProvider = new OpenAIProvider('demo-key');
    const openaiCaps = await openaiProvider.getImageCapabilities('gpt-4o');
    console.log(`- OpenAI GPT-4o Vision: ${openaiCaps.supportsImages} (max: ${openaiCaps.maxImageSizeMB}MB)`);
    
    const openaiNonVision = await openaiProvider.getImageCapabilities('gpt-3.5-turbo');
    console.log(`- OpenAI GPT-3.5: ${openaiNonVision.supportsImages} (max: ${openaiNonVision.maxImageSizeMB}MB)`);
    
    // Gemini Provider
    const geminiProvider = new GeminiProvider('demo-key');
    const geminiCaps = await geminiProvider.getImageCapabilities('pro');
    console.log(`- Gemini Pro Vision: ${geminiCaps.supportsImages} (max: ${geminiCaps.maxImageSizeMB}MB)`);
    console.log('');
    
    // Step 5: Validate images against capabilities
    console.log('✅ Validating Image Against Provider Capabilities:');
    
    const openaiValidation = await validateImages([dataUrl], openaiCaps);
    console.log(`- OpenAI validation: ${openaiValidation.valid ? 'PASS' : 'FAIL'}`);
    if (openaiValidation.totalSize) {
      console.log(`  Size: ${openaiValidation.totalSize.toFixed(2)}MB`);
    }
    
    const geminiValidation = await validateImages([dataUrl], geminiCaps);
    console.log(`- Gemini validation: ${geminiValidation.valid ? 'PASS' : 'FAIL'}`);
    if (geminiValidation.totalSize) {
      console.log(`  Size: ${geminiValidation.totalSize.toFixed(2)}MB`);
    }
    console.log('');
    
    // Step 6: Parse data URL and extract image
    console.log('🖼️  Extracting Image Data:');
    const parsed = parseDataUrl(dataUrl);
    if (parsed) {
      console.log(`- MIME Type: ${parsed.mimeType}`);
      console.log(`- Buffer Size: ${parsed.buffer.length} bytes`);
      
      // Save the actual image file
      const imageExt = metadata.extension;
      const imagePath = await saveBinaryToOutput(`demo-image-${DEMO_TIMESTAMP}${imageExt}`, parsed.buffer);
      console.log(`- Saved image: ${imagePath}`);
    }
    console.log('');
    
    // Step 7: Create comprehensive report
    console.log('📄 Generating Demo Report:');
    
    const report = {
      timestamp: new Date().toISOString(),
      demo_results: {
        source_url: DEMO_IMAGE_URL,
        image_metadata: {
          size_bytes: metadata.sizeBytes,
          size_kb: Math.round(metadata.sizeBytes / 1024 * 100) / 100,
          extension: metadata.extension,
          is_data_url: metadata.isDataUrl,
        },
        provider_capabilities: {
          openai_gpt4o: {
            supports_images: openaiCaps.supportsImages,
            max_size_mb: openaiCaps.maxImageSizeMB,
            supported_formats: openaiCaps.supportedFormats,
            validation_result: openaiValidation.valid,
          },
          gemini_pro: {
            supports_images: geminiCaps.supportsImages,
            max_size_mb: geminiCaps.maxImageSizeMB,
            supported_formats: geminiCaps.supportedFormats,
            validation_result: geminiValidation.valid,
          },
        },
        type_system_tests: {
          data_url_detection: isDataUrl(dataUrl),
          extension_validation: {
            png_valid: isValidImageExtension('.png'),
            txt_invalid: isValidImageExtension('.txt'),
          },
        },
        data_url_info: {
          total_length: dataUrl.length,
          mime_type: parsed?.mimeType,
          base64_size: parsed?.buffer.length,
        },
      },
    };
    
    const reportPath = await saveToOutput(`demo-report-${DEMO_TIMESTAMP}.json`, JSON.stringify(report, null, 2));
    console.log(`- Report saved: ${reportPath}`);
    
    // Step 8: Create a sample tool request
    const sampleRequest = {
      prompt: "Analyze this image and describe what you see",
      images: [dataUrl],
      model: "gpt-4o",
      temperature: 0.7,
    };
    
    const requestPath = await saveToOutput(`sample-request-${DEMO_TIMESTAMP}.json`, JSON.stringify(sampleRequest, null, 2));
    console.log(`- Sample request: ${requestPath}`);
    
    // Step 9: Save the data URL for reference
    const dataUrlPath = await saveToOutput(`data-url-${DEMO_TIMESTAMP}.txt`, dataUrl);
    console.log(`- Data URL saved: ${dataUrlPath}`);
    
    console.log('\n🎉 Image Support Demonstration Complete!');
    console.log('=========================================');
    console.log(`📁 All outputs saved to: ${OUTPUT_DIR}`);
    console.log('');
    console.log('Files created:');
    console.log(`- demo-image-${DEMO_TIMESTAMP}${metadata.extension} (actual image file)`);
    console.log(`- demo-report-${DEMO_TIMESTAMP}.json (complete analysis)`);
    console.log(`- sample-request-${DEMO_TIMESTAMP}.json (example tool request)`);
    console.log(`- data-url-${DEMO_TIMESTAMP}.txt (base64 data URL)`);
    console.log('');
    console.log('✅ The image support system is working correctly!');
    console.log('🔗 You can now use images in any zenode tool by providing:');
    console.log('   - File paths: "/path/to/image.png"');
    console.log('   - Data URLs: "data:image/png;base64,iVBORw0KGgo..."');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    
    // Save error report
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
    
    try {
      const errorPath = await saveToOutput(`error-report-${DEMO_TIMESTAMP}.json`, JSON.stringify(errorReport, null, 2));
      console.log(`📄 Error report saved: ${errorPath}`);
    } catch (saveError) {
      console.error('Failed to save error report:', saveError);
    }
    
    process.exit(1);
  }
}

// Run the demo if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runImageDemo().catch(console.error);
}

export { runImageDemo };