-- ============================================
-- Create Super Admin RPC Functions
-- ============================================
-- These functions allow Super Admin to bypass RLS for specific operations
-- They check the user role directly from public.users using provided user_id
-- ============================================

-- Function to get all inventory products (Super Admin only)
CREATE OR REPLACE FUNCTION super_admin_get_all_inventory_products(p_user_id text)
RETURNS TABLE (
  id text,
  user_id text,
  name text,
  sku text,
  retail_type text,
  pieces_per_carton integer,
  unit_price double precision,
  stock_pieces integer,
  created_at timestamp with time zone,
  unit_kind text,
  cost_price double precision,
  expiry_date text,
  low_stock_alert integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- If no user ID provided, return empty
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RETURN;
  END IF;
  
  -- Check if user has superadmin role
  SELECT role INTO user_role
  FROM public.users
  WHERE id = p_user_id;
  
  -- Only superadmin can access all data
  IF user_role != 'superadmin' THEN
    RAISE EXCEPTION 'Permission denied: Super Admin only';
  END IF;
  
  -- Return all inventory products
  RETURN QUERY
  SELECT 
    id::text,
    user_id::text,
    name,
    sku,
    retail_type,
    pieces_per_carton,
    unit_price,
    stock_pieces,
    created_at,
    unit_kind,
    cost_price,
    expiry_date,
    low_stock_alert
  FROM public.inventory_products
  ORDER BY name ASC;
END;
$$;

-- Function to insert inventory product (Super Admin only)
CREATE OR REPLACE FUNCTION super_admin_insert_inventory_product(
  p_requesting_user_id text,
  p_user_id text,
  p_name text,
  p_sku text,
  p_retail_type text,
  p_pieces_per_carton integer,
  p_unit_price double precision,
  p_stock_pieces integer,
  p_unit_kind text,
  p_cost_price double precision,
  p_expiry_date text,
  p_low_stock_alert integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  new_id text;
BEGIN
  -- If no requesting user ID, return error
  IF p_requesting_user_id IS NULL OR p_requesting_user_id = '' THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;
  
  -- Check if requesting user has superadmin role
  SELECT role INTO user_role
  FROM public.users
  WHERE id = p_requesting_user_id;
  
  -- Only superadmin can insert
  IF user_role != 'superadmin' THEN
    RAISE EXCEPTION 'Permission denied: Super Admin only';
  END IF;
  
  -- Insert the product
  INSERT INTO public.inventory_products (
    id, user_id, name, sku, retail_type, pieces_per_carton,
    unit_price, stock_pieces, unit_kind, cost_price, expiry_date, low_stock_alert
  )
  VALUES (
    gen_random_uuid()::text,
    p_user_id,
    p_name,
    p_sku,
    p_retail_type,
    p_pieces_per_carton,
    p_unit_price,
    p_stock_pieces,
    p_unit_kind,
    p_cost_price,
    p_expiry_date,
    p_low_stock_alert
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Function to get all HR employees (Super Admin only)
CREATE OR REPLACE FUNCTION super_admin_get_all_hr_employees(p_user_id text)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  national_id text,
  employee_id text,
  work_number text,
  role text,
  salary numeric,
  contract_type text,
  contract_end date,
  start_date date,
  birth_date date,
  marital_status text,
  uniform_color text,
  city text,
  address text,
  rib text,
  bank_name text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  work_days double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  -- If no user ID provided, return empty
  IF p_user_id IS NULL OR p_user_id = '' THEN
    RETURN;
  END IF;
  
  -- Check if user has superadmin role
  SELECT role INTO user_role
  FROM public.users
  WHERE id = p_user_id;
  
  -- Only superadmin can access all data
  IF user_role != 'superadmin' THEN
    RAISE EXCEPTION 'Permission denied: Super Admin only';
  END IF;
  
  -- Return all HR employees
  RETURN QUERY
  SELECT *
  FROM public.hr_employees
  ORDER BY created_at DESC;
END;
$$;

-- Function to insert HR employee (Super Admin only)
CREATE OR REPLACE FUNCTION super_admin_insert_hr_employee(
  p_requesting_user_id text,
  p_user_id uuid,
  p_name text,
  p_national_id text,
  p_employee_id text,
  p_work_number text,
  p_role text,
  p_salary numeric,
  p_contract_type text,
  p_contract_end date,
  p_start_date date,
  p_birth_date date,
  p_marital_status text,
  p_uniform_color text,
  p_city text,
  p_address text,
  p_rib text,
  p_bank_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  new_id uuid;
BEGIN
  -- If no requesting user ID, return error
  IF p_requesting_user_id IS NULL OR p_requesting_user_id = '' THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;
  
  -- Check if requesting user has superadmin role
  SELECT role INTO user_role
  FROM public.users
  WHERE id = p_requesting_user_id;
  
  -- Only superadmin can insert
  IF user_role != 'superadmin' THEN
    RAISE EXCEPTION 'Permission denied: Super Admin only';
  END IF;
  
  -- Insert the employee
  INSERT INTO public.hr_employees (
    id, user_id, name, national_id, employee_id, work_number, role,
    salary, contract_type, contract_end, start_date, birth_date,
    marital_status, uniform_color, city, address, rib, bank_name,
    created_at, updated_at, work_days
  )
  VALUES (
    gen_random_uuid(),
    p_user_id,
    p_name,
    p_national_id,
    p_employee_id,
    p_work_number,
    p_role,
    p_salary,
    p_contract_type,
    p_contract_end,
    p_start_date,
    p_birth_date,
    p_marital_status,
    p_uniform_color,
    p_city,
    p_address,
    p_rib,
    p_bank_name,
    NOW(),
    NOW(),
    0
  )
  RETURNING id INTO new_id;
  
  RETURN new_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.super_admin_get_all_inventory_products(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_insert_inventory_product(text, text, text, text, text, integer, double precision, integer, text, double precision, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_get_all_hr_employees(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_admin_insert_hr_employee(text, uuid, text, text, text, text, text, numeric, text, date, date, date, text, text, text, text, text, text) TO authenticated;

-- Verify the functions
SELECT proname, prosecdef 
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname LIKE 'super_admin_%'
AND n.nspname = 'public';
