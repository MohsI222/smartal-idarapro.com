-- Grant EXECUTE permissions for is_super_admin function
-- This fixes SQL permission error (Error Code 42501) when saving products

GRANT EXECUTE ON FUNCTION is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin() TO anon;

-- Set SECURITY DEFINER to allow the function to read from auth tables
ALTER FUNCTION is_super_admin() SECURITY DEFINER;
