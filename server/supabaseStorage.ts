/**
 * Supabase Storage utilities for server-side operations
 * Creates and manages the app-files bucket
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[Supabase Storage] Missing Supabase credentials. Storage operations will be disabled.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'app-files';

/**
 * Initialize the app-files bucket if it doesn't exist
 */
export async function initializeSupabaseStorage() {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('[Supabase Storage] Error listing buckets:', listError);
      return;
    }

    const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

    if (!bucketExists) {
      console.log(`[Supabase Storage] Creating bucket: ${BUCKET_NAME}`);
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: 1048576 * 5, // 5MB limit
      });

      if (createError) {
        console.error('[Supabase Storage] Error creating bucket:', createError);
      } else {
        console.log(`[Supabase Storage] Bucket ${BUCKET_NAME} created successfully`);
      }
    } else {
      console.log(`[Supabase Storage] Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (error) {
    console.error('[Supabase Storage] Initialization error:', error);
  }
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
    if (error) throw error;
  } catch (error) {
    console.error('[Supabase Storage] Delete error:', error);
    throw error;
  }
}
