-- Remove dangerous "Allow all operations" policy from auto_real_estate
-- This policy bypasses all security and allows any authenticated user to access all data

DROP POLICY IF EXISTS "Allow all operations on auto_real_estate" ON public.auto_real_estate;

-- Verify the policy was removed
SELECT policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'auto_real_estate';
