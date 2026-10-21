/**
 * Cloudinary Client for frontend file uploads
 * Uploads via server API to avoid exposing API keys
 */

import { api } from './api';

/**
 * Upload a file to Cloudinary via server API
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
    // Convert file to base64
    const base64 = await fileToBase64(file);
    
    // Upload via server API
    const data = await api<{ url: string }>('/cloudinary/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: base64,
        folder,
        fileName: file.name,
        fileType: file.type,
      }),
    });

    console.log('[Cloudinary Client] Upload success:', data.url);
    return data.url;
  } catch (error) {
    console.error('[Cloudinary Client] Upload error:', error);
    throw error;
  }
};

/**
 * Convert File to base64 string
 */
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
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
