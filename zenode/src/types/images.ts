/**
 * Image support type definitions for zenode
 * 
 * This module defines TypeScript types and constants for image processing
 * in the zenode MCP server, providing compile-time safety for image operations.
 */

/**
 * Supported image file extensions (AI model compatible formats)
 * Limited to formats supported by OpenAI and Gemini: PNG, JPEG, GIF, WebP
 */
export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'] as const;
export type ImageExtension = typeof IMAGE_EXTENSIONS[number];

/**
 * MIME type mappings for supported image formats
 */
export const IMAGE_MIME_TYPES: Record<ImageExtension, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png', 
  '.gif': 'image/gif',
  '.webp': 'image/webp',
} as const;

/**
 * Result of image validation operations
 */
export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  totalSize?: number;
  maxAllowed?: number;
  rejectedImages?: string[];
}

/**
 * Image capabilities for AI models/providers
 */
export interface ImageCapabilities {
  supportsImages: boolean;
  maxImageSizeMB: number;
  supportedFormats: readonly ImageExtension[];
}

/**
 * Image processing metadata
 */
export interface ImageMetadata {
  path: string;
  sizeBytes: number;
  extension: ImageExtension;
  isDataUrl: boolean;
  isHttpUrl?: boolean;
}

/**
 * Check if a file extension is a supported image format
 */
export function isValidImageExtension(extension: string): extension is ImageExtension {
  return IMAGE_EXTENSIONS.includes(extension.toLowerCase() as ImageExtension);
}

/**
 * Get MIME type for image extension
 */
export function getImageMimeType(extension: ImageExtension): string {
  return IMAGE_MIME_TYPES[extension];
}

/**
 * Extract extension from file path
 */
export function getImageExtension(filePath: string): ImageExtension | null {
  const extension = filePath.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/)?.[0];
  return extension && isValidImageExtension(extension) ? extension : null;
}

/**
 * Check if string is a data URL
 */
export function isDataUrl(input: string): boolean {
  return input.startsWith('data:image/');
}

/**
 * Check if string is an HTTP/HTTPS URL
 */
export function isHttpUrl(input: string): boolean {
  return input.startsWith('http://') || input.startsWith('https://');
}