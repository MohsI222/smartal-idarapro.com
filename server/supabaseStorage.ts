/**
 * Supabase Storage utilities for server-side operations
 * Creates and manages the app-files bucket
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
  } catch (error) {
    console.error('[Supabase Storage] Failed to create Supabase client:', error);
  }
} else {
  console.warn('[Supabase Storage] Missing Supabase credentials. Storage operations will be disabled.');
}

const BUCKET_NAME = 'app-files';

/**
 * Initialize the app-files bucket if it doesn't exist
 * NOTE: Disabled to avoid Supabase egress quota issues. Use Cloudinary instead.
 */
export async function initializeSupabaseStorage() {
  // Skip initialization to avoid egress quota consumption
  console.log('[Supabase Storage] Initialization skipped to avoid egress quota. Using Cloudinary instead.');
  return;
}

/**
 * Upload a file to Supabase Storage (app-files bucket)
 * NOTE: Disabled to avoid Supabase egress quota issues. Use Cloudinary instead.
 * @param fileBuffer - Buffer of the file to upload
 * @param path - Storage path (e.g., 'media-library/uuid.jpg')
 * @param contentType - MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  fileBuffer: Buffer,
  path: string,
  contentType: string
): Promise<string> {
  // Disabled to avoid egress quota consumption
  throw new Error('Supabase Storage upload disabled due to egress quota. Please use Cloudinary instead.');
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(path: string): Promise<void> {
  if (!supabase) {
    throw new Error('[Supabase Storage] Supabase client not available');
  }

  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
    if (error) throw error;
  } catch (error) {
    console.error('[Supabase Storage] Delete error:', error);
    throw error;
  }
}
