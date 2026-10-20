/**
 * Cloudinary Upload Routes
 * Handles file uploads to Cloudinary via server
 */

import express from 'express';
import multer from 'multer';
import { uploadToCloudinary, deleteFromCloudinary } from './cloudinaryService';

const router = express.Router();

// Configure multer for memory storage (no temp files)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Add URL-encoded middleware to parse form fields
router.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * POST /api/cloudinary/upload
 * Upload a file to Cloudinary
 * Body: FormData with 'file' and 'folder'
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('[Cloudinary API] Request received:', {
      hasFile: !!req.file,
      contentType: req.get('content-type'),
      bodyKeys: Object.keys(req.body),
      folder: req.body.folder,
    });

    const file = req.file;
    const folder = req.body.folder || 'general';

    if (!file) {
      console.error('[Cloudinary API] No file in request. req.file is undefined');
      return res.status(400).json({ error: 'No file provided' });
    }

    console.log('[Cloudinary API] Upload request:', {
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
