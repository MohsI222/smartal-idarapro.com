/**
 * Cloudinary Service for image/file storage
 * Replaces Supabase Storage to avoid egress quota issues
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary from environment variable
const cloudinaryUrl = process.env.CLOUDINARY_URL || '';

let cloudinaryConfigured = false;

if (cloudinaryUrl) {
  // Parse CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name
  const match = cloudinaryUrl.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
  if (match) {
    const [, apiKey, apiSecret, cloudName] = match;
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    cloudinaryConfigured = true;
    console.log('[Cloudinary] Configured successfully for cloud:', cloudName);
  } else {
    console.warn('[Cloudinary] Invalid CLOUDINARY_URL format');
  }
} else {
  console.warn('[Cloudinary] Missing CLOUDINARY_URL. Image upload will be disabled.');
}

/**
 * Upload a file to Cloudinary
 * @param fileBuffer - Buffer of the file to upload
 * @param folder - Cloudinary folder (e.g., 'products', 'delivery-hub', 'contracts')
 * @param fileName - Original file name
 * @param contentType - MIME type
 * @returns Public URL of the uploaded file with optimization parameters
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string,
  fileName: string,
  contentType?: string
): Promise<string> {
  if (!cloudinaryConfigured) {
    throw new Error('Cloudinary is not configured. Please set CLOUDINARY_URL environment variable.');
  }

  try {
    console.log('[Cloudinary] Uploading file:', {
      folder,
      fileName,
      size: fileBuffer.length,
      contentType,
    });

    // Sanitize filename: remove whitespace, keep letters, numbers, and basic chars
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    const sanitizedFileName = nameWithoutExt
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF.-]/g, '') // Keep Arabic and basic chars
      .substring(0, 50); // Limit length

    // Use a timestamp-based ID instead of filename to avoid signature issues
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const publicId = `${folder}/${timestamp}-${randomSuffix}`;

    // Upload to Cloudinary with auto-optimization (no transformation to avoid signature issues)
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'auto', // auto-detect image/video
          quality: 'auto:good', // automatic quality optimization
          fetch_format: 'auto', // automatic format conversion (WebP/AVIF)
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(fileBuffer);
    });

    console.log('[Cloudinary] Upload successful:', {
      publicId: result.public_id,
      url: result.secure_url,
      bytes: result.bytes,
    });

    // Return optimized URL with auto-quality and auto-format
    const optimizedUrl = cloudinary.url(result.public_id, {
      quality: 'auto:good',
      fetch_format: 'auto',
      secure: true,
    });

    console.log('[Cloudinary] Optimized URL:', optimizedUrl);
    return optimizedUrl;
  } catch (error) {
    console.error('[Cloudinary] Upload error:', error);
    throw error;
  }
}

/**
 * Delete a file from Cloudinary
 * @param publicId - Cloudinary public ID (folder/filename)
 */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  try {
    console.log('[Cloudinary] Deleting file:', publicId);
    const result = await cloudinary.uploader.destroy(publicId);
    console.log('[Cloudinary] Delete result:', result);
  } catch (error) {
    console.error('[Cloudinary] Delete error:', error);
    throw error;
  }
}

/**
 * Extract public ID from Cloudinary URL
 * @param url - Cloudinary URL
 * @returns Public ID for deletion
 */
export function extractPublicIdFromUrl(url: string): string {
  try {
    // Cloudinary URL format: https://res.cloudinary.com/cloud-name/image/upload/v1234567890/folder/filename.ext
    const match = url.match(/\/v\d+\/(.+?)(?:\.[a-z]+)?$/);
    return match ? match[1] : url;
  } catch {
    return url;
  }
}
