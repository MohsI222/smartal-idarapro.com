/**
 * Cloudinary Upload Routes
 * Handles file uploads to Cloudinary via server
 */

import express from 'express';
import { uploadToCloudinary as uploadToCloudinaryService } from './cloudinaryService';

const router = express.Router();

/**
 * POST /api/cloudinary/upload
 * Upload a file to Cloudinary
 * Body: JSON with 'file' (base64), 'folder', 'fileName', 'fileType'
 */
router.post('/upload', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { file, folder, fileName, fileType } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log('[Cloudinary API] Upload request:', {
      hasFile: !!file,
      folder,
      fileName,
      fileType,
    });

    // Convert base64 to buffer
    const buffer = Buffer.from(file, 'base64');

    // Upload to Cloudinary
    const url = await uploadToCloudinaryService(buffer, folder, fileName, fileType);

    console.log('[Cloudinary API] Upload success:', url);
    res.json({ url });
  } catch (error) {
    console.error('[Cloudinary API] Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;

      fileName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      folder,
    });

    // Upload to Cloudinary
    const url = await uploadToCloudinary(
      file.buffer,
      folder,
      file.originalname,
      file.mimetype
    );

    res.json({
      success: true,
      url,
      fileName: file.originalname,
      size: file.size,
    });
  } catch (error: any) {
    console.error('[Cloudinary API] Upload error:', error);
    res.status(500).json({
      error: error.message || 'فشل رفع الصورة / Upload failed',
    });
  }
});

/**
 * DELETE /api/cloudinary/delete
 * Delete a file from Cloudinary
 * Body: { publicId: string }
 */
router.delete('/delete', async (req, res) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ error: 'No publicId provided' });
    }

    await deleteFromCloudinary(publicId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Cloudinary API] Delete error:', error);
    res.status(500).json({
      error: error.message || 'فشل حذف الصورة / Delete failed',
    });
  }
});

export default router;
