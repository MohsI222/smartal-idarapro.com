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
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload via server API
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await api('/cloudinary/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'فشل رفع الصورة / Upload failed');
    }

    const data = await response.json();
    console.log('[Cloudinary Client] Upload success:', data.url);
    return data.url;
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
