-- Smart Al-Idara Pro — PostgreSQL schema (idempotent)
-- Run via initDatabase() on startup. Requires DATABASE_URL.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  whatsapp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referred_by TEXT,
  referral_code TEXT,
  trial_ends_at TIMESTAMPTZ,
  visa_unlock_requested_at TIMESTAMPTZ,
  visa_unlock_approved INTEGER NOT NULL DEFAULT 0,
  account_locked INTEGER NOT NULL DEFAULT 0,
  trial_balance DOUBLE PRECISION NOT NULL DEFAULT 1000,
  ai_api_key TEXT,
  ai_provider TEXT DEFAULT 'gemini'
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_api_key TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'gemini';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users (referral_code) WHERE referral_code IS NOT NULL AND referral_code <> '';

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  plan_id TEXT NOT NULL,
  modules TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  receipt_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  ends_at TIMESTAMPTZ,
  billing_period TEXT NOT NULL DEFAULT 'monthly'
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  fingerprint TEXT NOT NULL,
  label TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS hr_employees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  employee_id TEXT,
  work_number TEXT,
  national_id TEXT,
  role TEXT,
  salary DOUBLE PRECISION,
  work_days DOUBLE PRECISION NOT NULL DEFAULT 0,
  contract_type TEXT,
  contract_end TEXT,
  start_date TEXT,
  birth_date TEXT,
  marital_status TEXT,
  uniform_color TEXT,
  city TEXT,
  address TEXT,
  rib TEXT,
  bank_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS work_number TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS national_id TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS work_days DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS uniform_color TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS rib TEXT;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS bank_name TEXT;

-- Make employee_id nullable to allow saving with only name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'hr_employees'
  ) THEN
    ALTER TABLE hr_employees ALTER COLUMN employee_id DROP NOT NULL;
    ALTER TABLE hr_employees ALTER COLUMN role DROP NOT NULL;
    ALTER TABLE hr_employees ALTER COLUMN salary DROP NOT NULL;
    ALTER TABLE hr_employees ALTER COLUMN contract_type DROP NOT NULL;
  END IF;
END $$;

-- Disable RLS for hr_employees to allow all operations
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'hr_employees'
  ) THEN
    ALTER TABLE hr_employees DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL,
  can_access_inventory BOOLEAN DEFAULT false,
  can_access_hr BOOLEAN DEFAULT false,
  can_access_delivery BOOLEAN DEFAULT false,
  can_access_transport_logistics BOOLEAN DEFAULT false,
  can_access_wedding_invitations BOOLEAN DEFAULT false,
  can_access_legal BOOLEAN DEFAULT false,
  can_access_ai BOOLEAN DEFAULT false,
  can_access_settings BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lawyer_cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  client_name TEXT NOT NULL,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accountant_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  period TEXT NOT NULL,
  amount DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entry_type TEXT NOT NULL DEFAULT 'expense'
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  target TEXT NOT NULL,
  message TEXT NOT NULL,
  due_at TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_metrics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_label TEXT NOT NULL,
  production DOUBLE PRECISION NOT NULL,
  logistics DOUBLE PRECISION NOT NULL,
  quality DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_products (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  retail_type TEXT NOT NULL DEFAULT 'retail',
  pieces_per_carton INTEGER NOT NULL DEFAULT 1,
  unit_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  stock_pieces INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unit_kind TEXT NOT NULL DEFAULT 'piece',
  cost_price DOUBLE PRECISION NOT NULL DEFAULT 0,
  expiry_date TEXT,
  low_stock_alert INTEGER NOT NULL DEFAULT 10
);

CREATE TABLE IF NOT EXISTS pos_invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_name TEXT,
  lines_json TEXT NOT NULL,
  total DOUBLE PRECISION NOT NULL,
  paid DOUBLE PRECISION NOT NULL DEFAULT 0,
  credit DOUBLE PRECISION NOT NULL DEFAULT 0,
  due_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visa_user_profile (
  user_id TEXT PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  full_name TEXT,
  passport_no TEXT,
  phone TEXT,
  email TEXT,
  extra_json TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visa_appointment_status (
  user_id TEXT NOT NULL,
  center_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'soon',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, center_id),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS visa_radar_detections (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL,
  country TEXT NOT NULL,
  country_ar TEXT NOT NULL,
  city TEXT NOT NULL,
  city_ar TEXT NOT NULL,
  provider TEXT NOT NULL,
  url TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'open',
  notification_sent INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_visa_radar_detections_center ON visa_radar_detections (center_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_visa_radar_detections_time ON visa_radar_detections (detected_at DESC);

CREATE TABLE IF NOT EXISTS visa_radar_logs (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL,
  center_name TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visa_radar_logs_center ON visa_radar_logs (center_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visa_radar_logs_time ON visa_radar_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS visa_radar_patterns (
  id TEXT PRIMARY KEY,
  center_id TEXT NOT NULL UNIQUE,
  pattern_hours INTEGER[] NOT NULL DEFAULT '{}',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detection_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  from_admin INTEGER NOT NULL DEFAULT 0,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user ON support_messages (user_id, created_at);

CREATE TABLE IF NOT EXISTS internal_chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  from_admin INTEGER NOT NULL DEFAULT 0,
  body TEXT,
  attachment_name TEXT,
  attachment_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_chat_messages_user ON internal_chat_messages (user_id, created_at);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  tier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tl_workers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  full_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  center TEXT NOT NULL DEFAULT '',
  role_title TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL,
  hierarchy_role TEXT NOT NULL DEFAULT 'employee',
  reports_to_worker_id TEXT,
  magic_token TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tl_vehicle_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  department TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT NOT NULL,
  driver_id_doc TEXT NOT NULL DEFAULT '',
  vehicle_kind TEXT NOT NULL DEFAULT 'truck',
  expected_entry_at TEXT NOT NULL,
  entry_at TEXT,
  exit_at TEXT,
  passenger_count INTEGER,
  seat_count INTEGER,
  cargo_count INTEGER,
  box_count INTEGER,
  marked_success INTEGER NOT NULL DEFAULT 0,
  alert_level TEXT NOT NULL DEFAULT 'none',
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tl_ops_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  department TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  log_time TEXT NOT NULL,
  quantity DOUBLE PRECISION NOT NULL DEFAULT 0,
  delay_reason TEXT NOT NULL DEFAULT '',
  target_pct INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (worker_id) REFERENCES tl_workers (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tl_incidents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  ref_kind TEXT NOT NULL,
  ref_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tl_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id),
  from_worker_id TEXT NOT NULL,
  to_worker_id TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attachment_original_name TEXT,
  attachment_stored_path TEXT,
  attachment_mime TEXT,
  attachment_data BYTEA,
  FOREIGN KEY (from_worker_id) REFERENCES tl_workers (id) ON DELETE CASCADE,
  FOREIGN KEY (to_worker_id) REFERENCES tl_workers (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS correspondence_external_users (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  magic_token TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  national_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS correspondence_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  external_user_id TEXT REFERENCES correspondence_external_users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  body TEXT NOT NULL,
  attachment_original_name TEXT,
  attachment_stored_path TEXT,
  attachment_mime TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correspondence_external_users_token ON correspondence_external_users (magic_token);
CREATE INDEX IF NOT EXISTS idx_correspondence_external_users_user ON correspondence_external_users (user_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_messages_user ON correspondence_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_correspondence_messages_external ON correspondence_messages (external_user_id);

CREATE TABLE IF NOT EXISTS production_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_quantity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by TEXT,
  assigned_to TEXT,
  bom_items_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS logistics_queue (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  production_request_id TEXT REFERENCES production_requests (id) ON DELETE CASCADE,
  product_id TEXT,
  assigned_to TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tl_workers_user ON tl_workers (user_id);
CREATE INDEX IF NOT EXISTS idx_tl_vehicle_user ON tl_vehicle_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_tl_ops_user ON tl_ops_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_tl_incidents_user ON tl_incidents (user_id);
CREATE INDEX IF NOT EXISTS idx_tl_messages_user ON tl_messages (user_id);
CREATE INDEX IF NOT EXISTS idx_production_requests_user ON production_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_logistics_queue_user ON logistics_queue (user_id);

ALTER TABLE tl_messages ADD COLUMN IF NOT EXISTS attachment_data BYTEA;

CREATE TABLE IF NOT EXISTS media_library (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'youtube',
  title TEXT NOT NULL,
  url TEXT,
  youtube_video_id TEXT,
  file_path TEXT,
  file_name TEXT,
  file_mime TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_library_user ON media_library (user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_media_library_type ON media_library (type);

ALTER TABLE media_library ADD COLUMN IF NOT EXISTS is_public INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_media_library_public ON media_library (is_public, sort_order);

-- Academy Media Table - for training academy files
CREATE TABLE IF NOT EXISTS academy_media (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'video',
  title TEXT,
  description TEXT,
  url TEXT,
  file_path TEXT,
  file_name TEXT,
  file_mime TEXT,
  thumbnail_path TEXT,
  thumbnail_name TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_academy_media_user ON academy_media (user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_academy_media_type ON academy_media (type);

-- Delivery Hub Owners Table
-- Maps app user IDs to internal delivery hub owner IDs for RLS bypass
CREATE TABLE IF NOT EXISTS delivery_hub_owners (
  app_user_id TEXT PRIMARY KEY,
  owner_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_hub_owners_owner ON delivery_hub_owners(owner_id);

-- Delivery Hub Stores - Social Media Fields
-- These ALTER TABLE statements will be applied to the Supabase delivery_hub_stores table
-- Note: The actual table creation is in Supabase, these are just field additions

-- Add social media URL fields to delivery_hub_stores table (if they don't exist)
-- These should be run in Supabase SQL editor or via migration
/*
ALTER TABLE public.delivery_hub_stores
ADD COLUMN IF NOT EXISTS facebook_url TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_url TEXT;
*/
