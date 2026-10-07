/**
 * Utility functions for image compression and upload
 * Compresses images client-side before upload to save storage space
 */

const MAX_SIZE_BYTES = 100 * 1024; // 100KB

export const compressImage = async (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.7
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with specified quality
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
};

/**
 * Compress image to ensure it's under 100KB
 * Recursively reduces quality and dimensions if needed
 */
export const compressImageUnder100KB = async (
  file: File,
  initialQuality: number = 0.8,
  maxIterations: number = 10
): Promise<Blob> => {
  let quality = initialQuality;
  let maxDimension = 1200;
  
  for (let i = 0; i < maxIterations; i++) {
    const compressed = await compressImage(file, maxDimension, maxDimension, quality);
    
    if (compressed.size <= MAX_SIZE_BYTES) {
      console.log(`[ImageCompression] Compressed to ${compressed.size} bytes after ${i + 1} iterations`);
      return compressed;
    }
    
    // Reduce quality and dimensions for next iteration
    quality = Math.max(0.1, quality - 0.1);
    maxDimension = Math.max(300, maxDimension - 100);
  }
  
  // If still too large after max iterations, return the smallest we got
  const finalCompressed = await compressImage(file, 300, 300, 0.1);
  console.warn(`[ImageCompression] Could not compress under 100KB, final size: ${finalCompressed.size} bytes`);
  return finalCompressed;
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert blob to base64'));
  });
};

export const compressImageToBase64 = async (
  file: File,
  maxWidth: number = 800,
  maxHeight: number = 800,
  quality: number = 0.7
): Promise<string> => {
  const compressedBlob = await compressImage(file, maxWidth, maxHeight, quality);
  return blobToBase64(compressedBlob);
};
