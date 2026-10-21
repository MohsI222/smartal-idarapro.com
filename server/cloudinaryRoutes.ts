/**
 * Cloudinary Upload Routes
 * Handles file uploads to Cloudinary via server
 */

import express from 'express';
import { uploadToCloudinary as uploadToCloudinaryService } from './cloudinaryService.js';

const router = express.Router();

/**
 * POST /api/cloudinary/upload
 * Upload a file to Cloudinary
 * Body: JSON with 'file' (base64), 'folder', 'fileName', 'fileType'
 */
router.post('/upload', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { file, folder, fileName, fileType } = req.body;

    console.log('[Cloudinary API] Upload request received:', {
      hasFile: !!file,
      fileLength: file?.length,
      folder,
      fileName,
      fileType,
    });

    if (!file) {
      console.error('[Cloudinary API] No file provided');
      return res.status(400).json({ error: 'No file provided' });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(file, 'base64');
    console.log('[Cloudinary API] Buffer created, size:', buffer.length);

    // Upload to Cloudinary
    const url = await uploadToCloudinaryService(buffer, folder, fileName, fileType);

    console.log('[Cloudinary API] Upload success:', url);
    res.json({ url });
  } catch (error: any) {
    console.error('[Cloudinary API] Upload error:', error);
    console.error('[Cloudinary API] Error details:', {
      message: error.message,
      name: error.name,
      http_code: error.http_code,
    });
    res.status(500).json({ 
      error: 'Upload failed',
      details: error.message 
    });
  }
});

export default router;
