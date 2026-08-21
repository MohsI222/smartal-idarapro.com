const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = `
-- STORAGE: store-images bucket for logos and banners

-- Insert storage bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-images',
  'store-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view store images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload store images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete store images" ON storage.objects;

-- Allow public read access to store images
CREATE POLICY "Public can view store images"
ON storage.objects FOR SELECT
USING (bucket_id = 'store-images');

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated can upload store images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'store-images' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own images
CREATE POLICY "Authenticated can delete store images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'store-images' AND
  auth.role() = 'authenticated'
);
`;

async function applyMigration() {
  try {
    console.log('Applying storage bucket migration...');
    await pool.query(sql);
    console.log('✅ Migration applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
