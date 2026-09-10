-- Remove Foreign Key constraint on user_id to allow using AuthContext user.id
-- The AuthContext user.id may not exist in auth.users table, causing Foreign Key violations
ALTER TABLE public.auto_real_estate
DROP CONSTRAINT IF EXISTS auto_real_estate_user_id_fkey;

-- Add comment explaining why Foreign Key was removed
COMMENT ON COLUMN public.auto_real_estate.user_id IS 'User ID from AuthContext - Foreign Key removed to allow AuthContext user IDs that may not exist in auth.users table';
