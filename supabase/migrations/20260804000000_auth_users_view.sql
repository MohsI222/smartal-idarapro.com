-- Create a view to expose auth.users data for permissions management
-- This allows fetching users without needing service_role key

CREATE OR REPLACE VIEW auth_users_view AS
SELECT 
  id,
  email,
  raw_user_meta_data->>'name' as name,
  raw_user_meta_data->>'full_name' as full_name,
  created_at,
  updated_at,
  last_sign_in_at
FROM auth.users
WHERE deleted_at IS NULL;

-- Grant access to authenticated users
GRANT SELECT ON auth_users_view TO authenticated;

-- Create a function to get users with their permissions
CREATE OR REPLACE FUNCTION get_users_with_permissions()
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  name TEXT,
  can_access_inventory BOOLEAN,
  can_access_hr BOOLEAN,
  can_access_delivery BOOLEAN,
  can_access_transport_logistics BOOLEAN,
  can_access_wedding_invitations BOOLEAN,
  can_access_legal BOOLEAN,
  can_access_ai BOOLEAN,
  can_access_settings BOOLEAN,
  is_admin BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.raw_user_meta_data->>'name' as name,
    COALESCE(p.can_access_inventory, false) as can_access_inventory,
    COALESCE(p.can_access_hr, false) as can_access_hr,
    COALESCE(p.can_access_delivery, false) as can_access_delivery,
    COALESCE(p.can_access_transport_logistics, false) as can_access_transport_logistics,
    COALESCE(p.can_access_wedding_invitations, false) as can_access_wedding_invitations,
    COALESCE(p.can_access_legal, false) as can_access_legal,
    COALESCE(p.can_access_ai, false) as can_access_ai,
    COALESCE(p.can_access_settings, false) as can_access_settings,
    COALESCE(p.is_admin, false) as is_admin
  FROM auth.users u
  LEFT JOIN permissions p ON u.id = p.user_id
  WHERE u.deleted_at IS NULL
  ORDER BY u.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_users_with_permissions() TO authenticated;
