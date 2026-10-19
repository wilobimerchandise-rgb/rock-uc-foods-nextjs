/**
 * ROCK UC FOODS - Image Security and Validation Module
 * (Playbook v2 Section 7.B: Image Upload)
 * Validates magic bytes (not just file extension) and enforces 5 MB limit.
 * Never trust client-supplied MIME types or file extensions.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export type SupportedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ImageValidationResult {
  isValid: boolean;
  detectedType?: SupportedImageType;
  sizeBytes: number;
  error?: string;
}

/**
 * Validates an image buffer by reading raw magic header bytes.
 * Supported:
 * - JPEG: FF D8 FF
 * - PNG: 89 50 4E 47 0D 0A 1A 0A
 * - WebP: 52 49 46 46 (RIFF) + offset 8: 57 45 42 50 (WEBP)
 */
export function validateImageBuffer(buffer: Uint8Array | Buffer): ImageValidationResult {
  const sizeBytes = buffer.length;

  if (sizeBytes === 0) {
    return { isValid: false, sizeBytes, error: 'Empty file received.' };
  }

  if (sizeBytes > MAX_IMAGE_BYTES) {
    return {
      isValid: false,
      sizeBytes,
      error: `File size exceeds 5 MB limit (${(sizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  // Check JPEG (FF D8 FF)
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { isValid: true, detectedType: 'image/jpeg', sizeBytes };
  }

  // Check PNG (89 50 4E 47 0D 0A 1A 0A)
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { isValid: true, detectedType: 'image/png', sizeBytes };
  }

  // Check WebP (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return { isValid: true, detectedType: 'image/webp', sizeBytes };
  }

  return {
    isValid: false,
    sizeBytes,
    error: 'Unsupported image format. Allowed formats: genuine JPEG, PNG, or WebP.',
  };
}
