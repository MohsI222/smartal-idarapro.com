/**
 * Cloudinary Client for frontend file uploads
 * Uploads directly to Cloudinary using the SDK
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary from environment variable
const cloudinaryUrl = import.meta.env.VITE_CLOUDINARY_URL || '';

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
    console.log('[Cloudinary Client] Configured successfully for cloud:', cloudName);
  } else {
    console.warn('[Cloudinary Client] Invalid CLOUDINARY_URL format');
  }
} else {
  console.warn('[Cloudinary Client] Missing VITE_CLOUDINARY_URL');
}

/**
 * Upload a file to Cloudinary directly
 * @param file - File to upload
 * @param folder - Cloudinary folder (e.g., 'products', 'delivery-hub', 'contracts')
 * @returns Public URL of the uploaded file
 */
export const uploadToCloudinary = async (file: File, folder: string): Promise<string> => {
  console.log('[Cloudinary Client] Upload started:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    folder,
  });

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const publicId = `${folder}/${timestamp}-${randomSuffix}-${file.name.split('.')[0]}`;

    // Upload to Cloudinary
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'auto', // auto-detect image/video
          quality: 'auto:good', // automatic quality optimization
          fetch_format: 'auto', // automatic format conversion (WebP/AVIF)
          transformation: [
            { quality: 'auto:good', fetch_format: 'auto' },
            { width: 1200, crop: 'limit' }, // Limit max width to 1200px
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(file);
    });

    console.log('[Cloudinary Client] Upload successful:', {
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

    console.log('[Cloudinary Client] Optimized URL:', optimizedUrl);
    return optimizedUrl;
  } catch (error) {
    console.error('[Cloudinary Client] Upload error:', error);
    throw error;
  }
};

/**
 * Get optimized image URL from Cloudinary
 * @param publicId - Cloudinary public ID or URL
 * @param options - Transformation options
 * @returns Optimized URL
 */
export const getOptimizedImageUrl = (
  publicId: string,
  options: {
    width?: number;
    height?: number;
    quality?: string;
    format?: string;
  } = {}
): string => {
  const { width, height, quality = 'auto:good', format = 'auto' } = options;

  // If it's already a full URL, return it (Cloudinary URLs are already optimized)
  if (publicId.startsWith('http')) {
    return publicId;
  }

  // Build transformation string
  const transformations: string[] = [];
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  transformations.push(`q_${quality}`);
  transformations.push(`f_${format}`);

  const transformation = transformations.join(',');

  // Return Cloudinary URL with transformations
  return `https://res.cloudinary.com/goibxhzl/image/upload/${transformation}/${publicId}`;
};
