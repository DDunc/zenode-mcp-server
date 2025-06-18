/**
 * Image utilities for zenode MCP server
 * 
 * This module provides image validation and processing utilities using Node.js
 * built-in modules, optimized for the zenode architecture.
 */

import { promises as fs } from 'fs';
import { resolve, extname } from 'path';
import { logger } from './logger.js';
import { 
  ImageValidationResult, 
  ImageCapabilities, 
  ImageMetadata,
  getImageExtension,
  isValidImageExtension,
  isDataUrl,
  isHttpUrl,
  IMAGE_EXTENSIONS 
} from '../types/images.js';

/**
 * Validate a list of image paths against model capabilities
 * 
 * This function performs comprehensive validation including:
 * - File existence and accessibility
 * - Format validation (extension-based initially)
 * - Size validation against model limits
 * - Data URL parsing and validation
 */
export async function validateImages(
  imagePaths: string[], 
  capabilities: ImageCapabilities
): Promise<ImageValidationResult> {
  if (!imagePaths || imagePaths.length === 0) {
    return { valid: true };
  }

  // Check if model supports images at all
  if (!capabilities.supportsImages) {
    return {
      valid: false,
      error: 'Model does not support image processing. Please use a vision-capable model or remove images from your request.'
    };
  }

  const rejectedImages: string[] = [];
  let totalSize = 0;
  const maxBytes = capabilities.maxImageSizeMB * 1024 * 1024;

  logger.debug(`[IMAGE_VALIDATION] Validating ${imagePaths.length} images against capabilities:`, {
    supportsImages: capabilities.supportsImages,
    maxSizeMB: capabilities.maxImageSizeMB,
    supportedFormats: capabilities.supportedFormats
  });

  for (const imagePath of imagePaths) {
    try {
      const metadata = await getImageMetadata(imagePath);
      
      // Format validation
      if (!capabilities.supportedFormats.includes(metadata.extension)) {
        rejectedImages.push(imagePath);
        logger.debug(`[IMAGE_VALIDATION] Rejected ${imagePath}: unsupported format ${metadata.extension}`);
        continue;
      }

      // Size validation
      totalSize += metadata.sizeBytes;
      if (totalSize > maxBytes) {
        return {
          valid: false,
          error: `Images exceed size limit: ${(totalSize / (1024 * 1024)).toFixed(1)}MB > ${capabilities.maxImageSizeMB}MB`,
          totalSize: totalSize / (1024 * 1024),
          maxAllowed: capabilities.maxImageSizeMB,
          rejectedImages
        };
      }

      logger.debug(`[IMAGE_VALIDATION] Validated ${imagePath}: ${metadata.sizeBytes} bytes, ${metadata.extension}`);
    } catch (error) {
      rejectedImages.push(imagePath);
      logger.warn(`[IMAGE_VALIDATION] Failed to validate ${imagePath}:`, error);
    }
  }

  if (rejectedImages.length > 0) {
    return {
      valid: false,
      error: `Some images could not be validated: ${rejectedImages.join(', ')}`,
      rejectedImages
    };
  }

  logger.debug(`[IMAGE_VALIDATION] All images valid. Total size: ${(totalSize / (1024 * 1024)).toFixed(1)}MB`);
  return { valid: true, totalSize: totalSize / (1024 * 1024) };
}

/**
 * Get metadata for an image (file path, data URL, or HTTP URL)
 */
export async function getImageMetadata(imagePath: string): Promise<ImageMetadata> {
  if (isDataUrl(imagePath)) {
    return getDataUrlMetadata(imagePath);
  } else if (isHttpUrl(imagePath)) {
    return getHttpUrlMetadata(imagePath);
  } else {
    return getFileMetadata(imagePath);
  }
}

/**
 * Get metadata for a file-based image
 */
async function getFileMetadata(filePath: string): Promise<ImageMetadata> {
  try {
    const resolvedPath = resolve(filePath);
    const stats = await fs.stat(resolvedPath);
    
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${filePath}`);
    }

    const extension = getImageExtension(filePath);
    if (!extension) {
      throw new Error(`Unsupported image format: ${extname(filePath)}`);
    }

    return {
      path: resolvedPath,
      sizeBytes: stats.size,
      extension,
      isDataUrl: false
    };
  } catch (error) {
    throw new Error(`Failed to access image file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get metadata for an HTTP URL image
 */
async function getHttpUrlMetadata(httpUrl: string): Promise<ImageMetadata> {
  try {
    // Extract extension from URL (try different patterns)
    let extension: string | null = null;
    
    // Try extracting from URL path
    const urlPath = new URL(httpUrl).pathname;
    extension = getImageExtension(urlPath);
    
    // Fallback: assume JPG for images without clear extension
    if (!extension) {
      // Check if URL contains image format hints
      if (httpUrl.includes('jpeg') || httpUrl.includes('jpg')) {
        extension = '.jpg';
      } else if (httpUrl.includes('png')) {
        extension = '.png';
      } else if (httpUrl.includes('gif')) {
        extension = '.gif';
      } else if (httpUrl.includes('webp')) {
        extension = '.webp';
      } else {
        // Default to JPG for unknown formats
        extension = '.jpg';
      }
    }
    
    if (!isValidImageExtension(extension)) {
      throw new Error(`Unsupported image format in URL: ${extension}`);
    }

    return {
      path: httpUrl,
      sizeBytes: 0, // We can't easily determine size without fetching
      extension,
      isDataUrl: false,
      isHttpUrl: true
    };
  } catch (error) {
    throw new Error(`Failed to parse HTTP URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get metadata for a data URL image
 */
function getDataUrlMetadata(dataUrl: string): ImageMetadata {
  try {
    // Parse data URL: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...
    const match = dataUrl.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/i);
    
    if (!match || !match[1] || !match[2]) {
      throw new Error('Invalid data URL format');
    }

    const format = match[1]!;
    const base64Data = match[2]!;
    const extension = format === 'jpeg' ? '.jpg' : `.${format.toLowerCase()}`;
    
    if (!isValidImageExtension(extension)) {
      throw new Error(`Unsupported image format in data URL: ${format}`);
    }

    // Validate base64 data before calculating size
    if (!isValidBase64(base64Data)) {
      throw new Error('Invalid base64 data in data URL');
    }

    // Calculate size from base64 data
    const base64Length = base64Data.length;
    const padding = (base64Data.match(/=/g) || []).length;
    const sizeBytes = (base64Length * 3 / 4) - padding;

    return {
      path: dataUrl,
      sizeBytes,
      extension,
      isDataUrl: true
    };
  } catch (error) {
    throw new Error(`Failed to parse data URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate total size of multiple images
 */
export async function calculateTotalImageSize(imagePaths: string[]): Promise<number> {
  let totalSize = 0;
  
  for (const imagePath of imagePaths) {
    try {
      const metadata = await getImageMetadata(imagePath);
      totalSize += metadata.sizeBytes;
    } catch (error) {
      logger.warn(`Failed to get size for ${imagePath}:`, error);
      // Continue with other images
    }
  }
  
  return totalSize;
}

/**
 * Extract data URL buffer for processing
 */
export function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  try {
    const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !match[1] || !match[2]) return null;
    
    const [, mimeType, base64Data] = match;
    const buffer = Buffer.from(base64Data!, 'base64');
    
    return { mimeType: mimeType!, buffer };
  } catch (error) {
    logger.warn('Failed to parse data URL:', error);
    return null;
  }
}

/**
 * Validate base64 string format
 */
function isValidBase64(str: string): boolean {
  try {
    // Basic validation: check if it only contains valid base64 characters
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
      return false;
    }
    
    // Try to decode it - if it fails, it's invalid
    Buffer.from(str, 'base64');
    
    // Additional check: valid base64 length should be divisible by 4
    if (str.length % 4 !== 0) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if all images exist and are accessible
 */
export async function validateImageAccess(imagePaths: string[]): Promise<string[]> {
  const inaccessibleImages: string[] = [];
  
  for (const imagePath of imagePaths) {
    if (isDataUrl(imagePath)) {
      // Data URLs are always "accessible" if they parse correctly
      const parsed = parseDataUrl(imagePath);
      if (!parsed) {
        inaccessibleImages.push(imagePath);
      }
    } else if (isHttpUrl(imagePath)) {
      // HTTP URLs are considered accessible if they have a valid format
      // We don't fetch them here to avoid unnecessary network calls
      try {
        new URL(imagePath);
        // Valid URL format, assume accessible
      } catch (error) {
        inaccessibleImages.push(imagePath);
      }
    } else {
      try {
        await fs.access(resolve(imagePath));
      } catch (error) {
        inaccessibleImages.push(imagePath);
      }
    }
  }
  
  return inaccessibleImages;
}

/**
 * Process an image for vision API by converting it to base64 data URL
 * Supports file paths, data URLs, and HTTP URLs
 */
export async function processImageForVisionAPI(imagePath: string): Promise<string> {
  if (isDataUrl(imagePath)) {
    // Already a data URL, validate and return
    const parsed = parseDataUrl(imagePath);
    if (!parsed) {
      throw new Error(`Invalid data URL: ${imagePath.substring(0, 50)}...`);
    }
    return imagePath;
  }
  
  if (isHttpUrl(imagePath)) {
    // For HTTP URLs, return as-is for OpenRouter vision API
    // OpenRouter supports direct HTTP URLs in image_url format
    logger.debug(`[IMAGE_PROCESSING] Using HTTP URL directly: ${imagePath}`);
    return imagePath;
  }
  
  try {
    // Read file and convert to base64 data URL
    const resolvedPath = resolve(imagePath);
    const buffer = await fs.readFile(resolvedPath);
    
    // Determine MIME type from extension
    const extension = getImageExtension(imagePath);
    if (!extension) {
      throw new Error(`Unsupported image format: ${extname(imagePath)}`);
    }
    
    const mimeType = getMimeTypeFromExtension(extension);
    const base64Data = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    
    logger.debug(`[IMAGE_PROCESSING] Converted ${imagePath} to data URL (${buffer.length} bytes)`);
    return dataUrl;
    
  } catch (error) {
    throw new Error(`Failed to process image ${imagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get MIME type from image extension
 */
function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  
  const mimeType = mimeTypes[extension.toLowerCase()];
  if (!mimeType) {
    throw new Error(`Unsupported image extension: ${extension}`);
  }
  
  return mimeType;
}