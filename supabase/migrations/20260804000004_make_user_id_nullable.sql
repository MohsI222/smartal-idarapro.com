-- Make user_id column nullable in permissions table
-- Since we now use employee_id as the primary reference

ALTER TABLE permissions ALTER COLUMN user_id DROP NOT NULL;
