import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { getDataDir } from "./paths.js";

const dbPath = path.join(getDataDir(), "idara.sqlite");

export const db = new DatabaseSync(dbPath);

db.exec("PRAGMA journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    whatsapp TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    plan_id TEXT NOT NULL,
    modules TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    receipt_path TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_at TEXT,
    reviewed_by TEXT,
    ends_at TEXT
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    fingerprint TEXT NOT NULL,
    label TEXT,
    last_seen TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, fingerprint)
  );

  CREATE TABLE IF NOT EXISTS hr_employees (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    role TEXT NOT NULL,
    salary REAL NOT NULL,
    contract_type TEXT NOT NULL,
    contract_end TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS lawyer_cases (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    deadline TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accountant_reports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    period TEXT NOT NULL,
    amount REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    target TEXT NOT NULL,
    message TEXT NOT NULL,
    due_at TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS production_metrics (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    week_label TEXT NOT NULL,
    production REAL NOT NULL,
    logistics REAL NOT NULL,
    quality REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS inventory_products (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sku TEXT,
    retail_type TEXT NOT NULL DEFAULT 'retail',
    pieces_per_carton INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    stock_pieces INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pos_invoices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    customer_name TEXT,
    lines_json TEXT NOT NULL,
    total REAL NOT NULL,
    paid REAL NOT NULL DEFAULT 0,
    credit REAL NOT NULL DEFAULT 0,
    due_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS visa_user_profile (
    user_id TEXT PRIMARY KEY,
    full_name TEXT,
    passport_no TEXT,
    phone TEXT,
    email TEXT,
    extra_json TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS visa_appointment_status (
    user_id TEXT NOT NULL,
    center_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'soon',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, center_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN whatsapp TEXT");
} catch {
  /* العمود موجود مسبقاً */
}

try {
  db.exec(
    "ALTER TABLE accountant_reports ADD COLUMN entry_type TEXT NOT NULL DEFAULT 'expense'"
  );
} catch {
  /* موجود */
}

try {
  db.exec("ALTER TABLE inventory_products ADD COLUMN unit_kind TEXT NOT NULL DEFAULT 'piece'");
} catch {
  /* موجود */
}
try {
  db.exec("ALTER TABLE inventory_products ADD COLUMN cost_price REAL NOT NULL DEFAULT 0");
} catch {
  /* موجود */
}
try {
  db.exec("ALTER TABLE inventory_products ADD COLUMN expiry_date TEXT");
} catch {
  /* موجود */
}
try {
  db.exec("ALTER TABLE inventory_products ADD COLUMN low_stock_alert INTEGER NOT NULL DEFAULT 10");
} catch {
  /* موجود */
}

try {
  db.exec("ALTER TABLE subscriptions ADD COLUMN ends_at TEXT");
} catch {
  /* موجود */
}

try {
  db.exec("ALTER TABLE subscriptions ADD COLUMN billing_period TEXT NOT NULL DEFAULT 'monthly'");
} catch {
  /* موجود */
}

try {
  db.exec("ALTER TABLE users ADD COLUMN referred_by TEXT");
} catch {
  /* موجود */
}
try {
  db.exec("ALTER TABLE users ADD COLUMN referral_code TEXT");
} catch {
  /* موجود */
}
try {
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code) WHERE referral_code IS NOT NULL AND referral_code != ''"
  );
} catch {
  /* قد يكون الفهرس موجوداً أو عمود غير جاهز */
}
try {
  db.exec("ALTER TABLE users ADD COLUMN trial_ends_at TEXT");
} catch {
  /* موجود */
}
try {
  db.exec("ALTER TABLE users ADD COLUMN visa_unlock_requested_at TEXT");
} catch {
  /* موجود */
}
try {
  db.exec("ALTER TABLE users ADD COLUMN visa_unlock_approved INTEGER NOT NULL DEFAULT 0");
} catch {
  /* موجود */
}

try {
  db.exec("ALTER TABLE users ADD COLUMN account_locked INTEGER NOT NULL DEFAULT 0");
} catch {
  /* موجود */
}

/** رصيد تجريبي لوحدات الذكاء الاصطناعي والاختبار — افتراضي 1000 للمستخدمين الجدد */
try {
  db.exec("ALTER TABLE users ADD COLUMN trial_balance REAL NOT NULL DEFAULT 1000");
} catch {
  /* موجود */
}

db.exec(`
  CREATE TABLE IF NOT EXISTS support_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    from_admin INTEGER NOT NULL DEFAULT 0,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_support_messages_user ON support_messages(user_id, created_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS referral_rewards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    tier TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

try {
  db.exec(
    `UPDATE subscriptions SET ends_at = datetime('now', '+365 days') WHERE status = 'approved' AND (ends_at IS NULL OR ends_at = '')`
  );
} catch {
  /* ignore */
}

/** Smart Transport & Logistics Pro — workers, vehicles, ops logs, incidents, internal messaging */
db.exec(`
  CREATE TABLE IF NOT EXISTS tl_workers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    full_name TEXT NOT NULL,
    employee_id TEXT NOT NULL,
    center TEXT NOT NULL DEFAULT '',
    role_title TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL,
    hierarchy_role TEXT NOT NULL DEFAULT 'employee',
    reports_to_worker_id TEXT,
    magic_token TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tl_vehicle_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
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
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tl_ops_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    department TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    log_time TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    delay_reason TEXT NOT NULL DEFAULT '',
    target_pct INTEGER NOT NULL DEFAULT 100,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (worker_id) REFERENCES tl_workers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tl_incidents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    ref_kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    severity TEXT NOT NULL,
    summary TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tl_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    from_worker_id TEXT NOT NULL,
    to_worker_id TEXT NOT NULL,
    body TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (from_worker_id) REFERENCES tl_workers(id) ON DELETE CASCADE,
    FOREIGN KEY (to_worker_id) REFERENCES tl_workers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tl_workers_user ON tl_workers(user_id);
  CREATE INDEX IF NOT EXISTS idx_tl_vehicle_user ON tl_vehicle_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_tl_ops_user ON tl_ops_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_tl_incidents_user ON tl_incidents(user_id);
  CREATE INDEX IF NOT EXISTS idx_tl_messages_user ON tl_messages(user_id);
`);

try {
  db.exec(`ALTER TABLE tl_messages ADD COLUMN attachment_original_name TEXT`);
} catch {
  /* موجود */
}
try {
  db.exec(`ALTER TABLE tl_messages ADD COLUMN attachment_stored_path TEXT`);
} catch {
  /* موجود */
}
try {
  db.exec(`ALTER TABLE tl_messages ADD COLUMN attachment_mime TEXT`);
} catch {
  /* موجود */
}
