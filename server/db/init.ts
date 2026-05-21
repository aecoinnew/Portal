import { db } from "./connection.js";

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  phone TEXT,
  relationship_manager TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT,
  type TEXT NOT NULL CHECK (type IN ('stock', 'crypto', 'fund', 'sukuk', 'private')),
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('api', 'manual')),
  currency TEXT NOT NULL DEFAULT 'AED' CHECK (currency IN ('AED', 'USD')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_positions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity REAL NOT NULL CHECK (quantity >= 0),
  avg_price REAL NOT NULL CHECK (avg_price >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  price REAL NOT NULL CHECK (price >= 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'api')),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_price_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price REAL NOT NULL CHECK (price >= 0),
  source TEXT NOT NULL CHECK (source IN ('manual', 'api')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investment_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('buy', 'sell', 'subscribe', 'withdraw')),
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  amount REAL CHECK (amount IS NULL OR amount >= 0),
  currency TEXT NOT NULL DEFAULT 'AED' CHECK (currency IN ('AED', 'USD')),
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'executed')),
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS statements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY CHECK (id = 'global'),
  base_currency TEXT NOT NULL DEFAULT 'AED' CHECK (base_currency IN ('AED', 'USD')),
  allow_usd INTEGER NOT NULL DEFAULT 1 CHECK (allow_usd IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_positions_user ON portfolio_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_status ON investment_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_statements_user ON statements(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
`);

console.log("SQLite schema initialized.");

// --- Migration: Phase 2 - Add approval_requests table ---
const approvalTableExists = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='approval_requests'"
).get() as { name: string } | undefined;

if (!approvalTableExists) {
  console.log("Phase 2: Creating approval_requests table...");

  db.exec(`
    CREATE TABLE approval_requests (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      requested_by_user_id TEXT NOT NULL REFERENCES users(id),
      assigned_role TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'executed')),
      before_value TEXT,
      after_value TEXT,
      reason TEXT,
      decision_by_user_id TEXT REFERENCES users(id),
      decision_reason TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      executed_at TEXT
    );

    CREATE INDEX idx_approval_requested_by ON approval_requests(requested_by_user_id);
    CREATE INDEX idx_approval_status ON approval_requests(status);
    CREATE INDEX idx_approval_entity ON approval_requests(entity_type, entity_id);
    CREATE INDEX idx_approval_created ON approval_requests(created_at DESC);
  `);

  console.log("Phase 2: approval_requests table created.");
}

// --- Migration: Expand role CHECK constraint for institutional RBAC ---
const ALLOWED_ROLES = [
  "super_admin",
  "admin",
  "operations",
  "relationship_manager",
  "compliance",
  "finance",
  "auditor",
  "client"
];

const roleCheckValues = ALLOWED_ROLES.map((r) => `'${r}'`).join(", ");
const newRoleCheck = `role IN (${roleCheckValues})`;

const tableInfo = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>;
// Check if the role constraint already includes expanded roles.
// We do this by checking if the table SQL in sqlite_master contains 'super_admin'.
const userTableSql = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='users'"
).get() as { sql: string } | undefined;
const hasExpandedRoles = userTableSql?.sql?.includes("super_admin") ?? false;

if (!hasExpandedRoles) {
  console.log("Migrating users table: expanding role constraint...");

  db.exec(`
    PRAGMA foreign_keys = OFF;

    BEGIN TRANSACTION;

    CREATE TABLE users_new (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (${newRoleCheck}),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
      phone TEXT,
      relationship_manager TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1))
    );

    INSERT INTO users_new (id, name, email, password_hash, role, status, phone, relationship_manager, created_at, updated_at, must_change_password)
    SELECT id, name, email, password_hash, role, status, phone, relationship_manager, created_at, updated_at,
           COALESCE(must_change_password, 0)
    FROM users;

    DROP TABLE users;

    ALTER TABLE users_new RENAME TO users;

    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);

    COMMIT;

    PRAGMA foreign_keys = ON;
  `);

  console.log("Migration complete: role constraint expanded to institutional roles.");
}

// --- Existing migrations ---
const requestColumns = db.prepare("PRAGMA table_info(investment_requests)").all() as Array<{ name: string }>;
if (!requestColumns.some((column) => column.name === "currency")) {
  db.prepare("ALTER TABLE investment_requests ADD COLUMN currency TEXT NOT NULL DEFAULT 'AED' CHECK (currency IN ('AED', 'USD'))").run();
}

db.prepare("UPDATE products SET currency = 'AED' WHERE currency = 'SAR'").run();
db.prepare("UPDATE investment_requests SET currency = 'AED' WHERE currency = 'SAR'").run();
db.prepare(
  `
  INSERT OR IGNORE INTO app_settings (id, base_currency, allow_usd, updated_at)
  VALUES ('global', 'AED', 1, datetime('now'))
  `
).run();

// --- Migration: Add must_change_password column ---
const userCols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
if (!userCols.some((c) => c.name === "must_change_password")) {
  db.prepare(
    "ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0,1))"
  ).run();
  console.log("Migration: added users.must_change_password");
}

// --- Migration: widen approval_requests.status to include 'executing' ---
const apTableSql = db.prepare(
  "SELECT sql FROM sqlite_master WHERE type='table' AND name='approval_requests'"
).get() as { sql: string } | undefined;

if (apTableSql && !apTableSql.sql.includes("'executing'")) {
  console.log("Migration: adding 'executing' to approval_requests.status CHECK constraint...");
  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN TRANSACTION;

    CREATE TABLE approval_requests_new (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      requested_by_user_id TEXT NOT NULL REFERENCES users(id),
      assigned_role TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'executing', 'executed')),
      before_value TEXT,
      after_value TEXT,
      reason TEXT,
      decision_by_user_id TEXT REFERENCES users(id),
      decision_reason TEXT,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      executed_at TEXT
    );

    INSERT INTO approval_requests_new
      (id, entity_type, entity_id, action, requested_by_user_id, assigned_role,
       status, before_value, after_value, reason, decision_by_user_id, decision_reason,
       created_at, decided_at, executed_at)
    SELECT
      id, entity_type, entity_id, action, requested_by_user_id, assigned_role,
      status, before_value, after_value, reason, decision_by_user_id, decision_reason,
      created_at, decided_at, executed_at
    FROM approval_requests;

    DROP TABLE approval_requests;
    ALTER TABLE approval_requests_new RENAME TO approval_requests;

    CREATE INDEX idx_approval_requested_by ON approval_requests(requested_by_user_id);
    CREATE INDEX idx_approval_status ON approval_requests(status);
    CREATE INDEX idx_approval_entity ON approval_requests(entity_type, entity_id);
    CREATE INDEX idx_approval_created ON approval_requests(created_at DESC);

    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
  console.log("Migration: approval_requests.status widened to include 'executing'");
}

// --- Migration: Add last_login_at column ---
const userColsLast = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
if (!userColsLast.some((c) => c.name === "last_login_at")) {
  db.prepare("ALTER TABLE users ADD COLUMN last_login_at TEXT").run();
  console.log("Migration: added users.last_login_at");
}
