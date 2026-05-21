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
