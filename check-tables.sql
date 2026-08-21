-- Check if required tables exist in Supabase
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('products', 'production_requests', 'logistics_queue', 'stores', 'invoices')
ORDER BY table_name;

-- Check columns in products table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;

-- Check columns in production_requests table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'production_requests' 
ORDER BY ordinal_position;

-- Check columns in logistics_queue table
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'logistics_queue' 
ORDER BY ordinal_position;
