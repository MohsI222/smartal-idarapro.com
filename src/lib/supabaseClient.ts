/**
 * Supabase client for file storage (app-files bucket)
 * Used for storing product images and other files
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing Supabase credentials. File upload will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload a file to Supabase Storage (app-files bucket)
 * @param file - File to upload
 * @param path - Storage path (e.g., 'products/uuid.jpg')
 * @returns Public URL of the uploaded file
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  try {
    const { data, error } = await supabase.storage
      .from('app-files')
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) throw error;

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('app-files')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('[Supabase] Upload error:', error);
    throw error;
  }
};

/**
 * Delete a file from Supabase Storage
 * @param path - Storage path to delete
 */
export const deleteFile = async (path: string): Promise<void> => {
  try {
    const { error } = await supabase.storage
      .from('app-files')
      .remove([path]);

    if (error) throw error;
  } catch (error) {
    console.error('[Supabase] Delete error:', error);
    throw error;
  }
};
