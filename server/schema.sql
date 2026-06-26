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
  trial_balance DOUBLE PRECISION NOT NULL DEFAULT 1000
);

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
  employee_id TEXT NOT NULL,
  role TEXT NOT NULL,
  salary DOUBLE PRECISION NOT NULL,
  contract_type TEXT NOT NULL,
  contract_end TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
