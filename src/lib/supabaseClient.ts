/**
 * Supabase client for file storage (app-files bucket)
 * Used for storing product images and other files
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('[Supabase] Config:', {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'none',
  keyPrefix: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'none'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] Missing Supabase credentials. File upload will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Upload a file to Supabase Storage (app-files bucket)
 * @param file - File to upload
 * @param path - Storage path (e.g., 'products/uuid.jpg')
 * @returns Public URL of the uploaded file
 */
export const uploadFile = async (file: File, path: string): Promise<string> => {
  console.log('[Supabase] Upload started:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    path
  });

  try {
    const { data, error } = await supabase.storage
      .from('app-files')
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      console.error('[Supabase] Upload failed:', error);
      throw error;
    }

    console.log('[Supabase] Upload success:', {
      path: data.path,
      fullPath: data.fullPath
    });

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('app-files')
      .getPublicUrl(data.path);

    console.log('[Supabase] Public URL:', publicUrlData.publicUrl);
    return publicUrlData.publicUrl;
  } catch (error: any) {
    console.error('[Supabase] Upload error:', error);

    // Check if it's a quota error
    if (error?.status === 402 || error?.message?.includes('exceed_egress_quota')) {
      throw new Error('تجاوز مشروع Supabase حد التخزين. يرجى الذهاب إلى Supabase Dashboard > Settings > Billing ورفع الـ spend cap أو ترقية الخطة. / Supabase project exceeded storage quota. Please go to Supabase Dashboard > Settings > Billing to remove spend cap or upgrade plan.');
    }

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
