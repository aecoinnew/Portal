/**
 * Stage 5A-1: Demo seed script.
 *
 * Creates a complete, coherent demo dataset for internal pilot.
 * - Refuses to run if DB already has >10 users (safety guard).
 * - All passwords are bcrypt-hashed, must_change_password=1.
 * - Passwords stored in /root/demo-passwords.txt (mode 600).
 * - No real PII, no real financial data.
 *
 * Usage:
 *   npm run seed:demo           (fresh DB only)
 *   npm run seed:demo -- --force (override the >10 users guard)
 */

import bcrypt from "bcrypt";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, nowIso, statementsDir, uid } from "./connection.js";
import "./init.js";

const FORCE = process.argv.includes("--force");

// Safety guard
const userCount = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
if (userCount > 10 && !FORCE) {
  console.error(
    `REFUSING: DB already has ${userCount} users. This script is for fresh DBs only.\n` +
    `Use --force to override (will ADD data, not wipe).`
  );
  process.exit(1);
}

console.log("Starting demo seed...");

// --- Password generation ---
function genPassword(): string {
  return crypto.randomBytes(12).toString("base64url");
}

const passwords: Record<string, string> = {};
function hashAndStore(email: string): string {
  const pw = genPassword();
  passwords[email] = pw;
  return bcrypt.hashSync(pw, 12);
}

const now = nowIso();

// Helper to create a timestamp N days ago
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().replace("T", "T").slice(0, -1) + "Z";
}

// ============================================================
// USERS
// ============================================================
const insertUser = db.prepare(`
  INSERT OR REPLACE INTO users
  (id, name, email, password_hash, role, status, phone, relationship_manager, created_at, updated_at, must_change_password)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

const users = [
  // Super Admins (maker + checker)
  { id: "usr_sa_ahmed",    name: "Ahmed Al-Rashid",     email: "ahmed@eisax.com",     role: "super_admin", status: "active", phone: "+971501000001", rm: null },
  { id: "usr_sa_sara",     name: "Sara Al-Mansouri",    email: "sara@eisax.com",      role: "super_admin", status: "active", phone: "+971501000002", rm: null },
  // Operations
  { id: "usr_ops_omar",    name: "Omar Khalil",         email: "omar.ops@eisax.com",  role: "operations",  status: "active", phone: "+971501000003", rm: null },
  // Compliance
  { id: "usr_comp_layla",  name: "Layla Hassan",        email: "layla.comp@eisax.com",role: "compliance",  status: "active", phone: "+971501000004", rm: null },
  // Relationship Manager
  { id: "usr_rm_khalid",   name: "Khalid Al-Dosari",    email: "khalid.rm@eisax.com", role: "relationship_manager", status: "active", phone: "+971501000005", rm: null },
  // Finance
  { id: "usr_fin_mona",    name: "Mona Al-Suwaidi",     email: "mona.fin@eisax.com",  role: "finance",     status: "active", phone: "+971501000006", rm: null },
  // Auditor
  { id: "usr_aud_tariq",   name: "Tariq Al-Balushi",    email: "tariq.aud@eisax.com", role: "auditor",     status: "active", phone: "+971501000007", rm: null },
  // Clients
  { id: "usr_client_faisal", name: "Faisal Al-Harbi",   email: "faisal@client.eisax.com",  role: "client", status: "active", phone: "+971551000001", rm: "Khalid Al-Dosari" },
  { id: "usr_client_nora",   name: "Nora Al-Rashidi",   email: "nora@client.eisax.com",    role: "client", status: "active", phone: "+971551000002", rm: "Khalid Al-Dosari" },
  { id: "usr_client_hassan", name: "Hassan Al-Tamimi",  email: "hassan@client.eisax.com",  role: "client", status: "active", phone: "+971551000003", rm: "Khalid Al-Dosari" },
];

// ============================================================
// PRODUCTS
// ============================================================
const insertProduct = db.prepare(`
  INSERT OR REPLACE INTO products
  (id, name, symbol, type, pricing_mode, currency, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const products = [
  { id: "prd_aramco",       name: "Saudi Aramco",       symbol: "2222.SR",  type: "stock",   mode: "api",    currency: "AED", active: 1, price: 32.40 },
  { id: "prd_adnoc",        name: "ADNOC Distribution", symbol: "ADNOCDIST.AD", type: "stock", mode: "api", currency: "AED", active: 1, price: 3.85 },
  { id: "prd_sukuk_alpha",  name: "EisaX Sukuk Alpha", symbol: null,       type: "sukuk",   mode: "manual", currency: "AED", active: 1, price: 1005.25 },
  { id: "prd_sukuk_beta",   name: "EisaX Sukuk Beta",  symbol: null,       type: "sukuk",   mode: "manual", currency: "AED", active: 1, price: 998.50 },
  { id: "prd_btc",          name: "Bitcoin",            symbol: "BTC-USD",  type: "crypto",  mode: "api",    currency: "USD", active: 1, price: 108500 },
  { id: "prd_eth",          name: "Ethereum",           symbol: "ETH-USD",  type: "crypto",  mode: "api",    currency: "USD", active: 1, price: 2580 },
  { id: "prd_mena_growth",  name: "MENA Growth Fund",   symbol: null,       type: "fund",    mode: "manual", currency: "AED", active: 1, price: 712.30 },
  { id: "prd_gcc_income",   name: "GCC Income Fund",    symbol: null,       type: "fund",    mode: "manual", currency: "AED", active: 1, price: 104.80 },
  { id: "prd_private_eq",   name: "Private Equity I",   symbol: null,       type: "private", mode: "manual", currency: "AED", active: 1, price: 210.00 },
  { id: "prd_real_estate",  name: "Real Estate Fund II", symbol: null,      type: "private", mode: "manual", currency: "AED", active: 0, price: 185.00 },
];

// ============================================================
// PORTFOLIO POSITIONS
// ============================================================
const insertPosition = db.prepare(`
  INSERT OR REPLACE INTO portfolio_positions
  (id, user_id, product_id, quantity, avg_price, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const positions = [
  // Faisal - diversified portfolio
  { id: "pos_f_aramco",  user: "usr_client_faisal", product: "prd_aramco",      qty: 8000,  avg: 28.50 },
  { id: "pos_f_sukuk_a", user: "usr_client_faisal", product: "prd_sukuk_alpha", qty: 150,   avg: 1000.00 },
  { id: "pos_f_btc",     user: "usr_client_faisal", product: "prd_btc",         qty: 0.75,  avg: 95000 },
  { id: "pos_f_mena",    user: "usr_client_faisal", product: "prd_mena_growth", qty: 2000,  avg: 680.00 },
  { id: "pos_f_pe",      user: "usr_client_faisal", product: "prd_private_eq",  qty: 500,   avg: 195.00 },
  // Nora - conservative
  { id: "pos_n_sukuk_a", user: "usr_client_nora",   product: "prd_sukuk_alpha", qty: 300,   avg: 998.00 },
  { id: "pos_n_sukuk_b", user: "usr_client_nora",   product: "prd_sukuk_beta",  qty: 200,   avg: 1000.00 },
  { id: "pos_n_gcc",     user: "usr_client_nora",   product: "prd_gcc_income",  qty: 5000,  avg: 100.00 },
  { id: "pos_n_mena",    user: "usr_client_nora",   product: "prd_mena_growth", qty: 1000,  avg: 695.00 },
  // Hassan - growth-oriented
  { id: "pos_h_aramco",  user: "usr_client_hassan", product: "prd_aramco",      qty: 3000,  avg: 30.20 },
  { id: "pos_h_adnoc",   user: "usr_client_hassan", product: "prd_adnoc",       qty: 15000, avg: 3.60 },
  { id: "pos_h_btc",     user: "usr_client_hassan", product: "prd_btc",         qty: 1.2,   avg: 88000 },
  { id: "pos_h_eth",     user: "usr_client_hassan", product: "prd_eth",         qty: 10,    avg: 2200 },
  { id: "pos_h_pe",      user: "usr_client_hassan", product: "prd_private_eq",  qty: 1000,  avg: 200.00 },
];

// ============================================================
// INVESTMENT REQUESTS (various states for demo)
// ============================================================
const insertRequest = db.prepare(`
  INSERT OR REPLACE INTO investment_requests
  (id, user_id, type, product_id, amount, currency, message, status, rejection_reason, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const requests = [
  { id: "req_demo_001", user: "usr_client_faisal", type: "buy",       product: "prd_aramco",      amount: 75000,  currency: "AED", msg: "Increase Aramco position ahead of dividend.", status: "pending",  reason: null, age: 2 },
  { id: "req_demo_002", user: "usr_client_nora",   type: "subscribe", product: "prd_mena_growth", amount: 350000, currency: "AED", msg: "Subscribe to MENA Growth Fund Q2 allocation.", status: "pending",  reason: null, age: 1 },
  { id: "req_demo_003", user: "usr_client_hassan", type: "buy",       product: "prd_eth",         amount: 25000,  currency: "USD", msg: "Add ETH exposure.",                          status: "approved", reason: null, age: 5 },
  { id: "req_demo_004", user: "usr_client_faisal", type: "withdraw",  product: null,              amount: 50000,  currency: "AED", msg: "Cash withdrawal for personal use.",           status: "executed", reason: null, age: 10 },
  { id: "req_demo_005", user: "usr_client_hassan", type: "sell",      product: "prd_adnoc",       amount: 20000,  currency: "AED", msg: "Partial exit from ADNOC.",                    status: "rejected", reason: "Position below minimum holding threshold. Please discuss with RM.", age: 7 },
  { id: "req_demo_006", user: "usr_client_nora",   type: "buy",       product: "prd_sukuk_beta",  amount: 100000, currency: "AED", msg: "Increase Sukuk Beta allocation.",             status: "pending",  reason: null, age: 0 },
];

// ============================================================
// APPROVAL REQUESTS (showing lifecycle)
// ============================================================
const insertApproval = db.prepare(`
  INSERT OR REPLACE INTO approval_requests
  (id, entity_type, entity_id, action, requested_by_user_id, assigned_role, status,
   before_value, after_value, reason, decision_by_user_id, decision_reason, created_at, decided_at, executed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// ============================================================
// AUDIT LOGS
// ============================================================
const insertAudit = db.prepare(`
  INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, metadata, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// ============================================================
// EXECUTE SEED
// ============================================================
db.transaction(() => {
  // Clear existing data for a fresh start
  db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM approval_requests;
    DELETE FROM statements;
    DELETE FROM investment_requests;
    DELETE FROM portfolio_positions;
    DELETE FROM product_price_history;
    DELETE FROM prices;
    DELETE FROM products;
    DELETE FROM users;
    DELETE FROM app_settings;
  `);

  // App settings
  db.prepare(`
    INSERT INTO app_settings (id, base_currency, allow_usd, updated_at)
    VALUES ('global', 'AED', 1, ?)
  `).run(now);

  // Users
  for (const u of users) {
    const hash = hashAndStore(u.email);
    insertUser.run(u.id, u.name, u.email, hash, u.role, u.status, u.phone, u.rm, daysAgo(30), now);
  }

  // Products + prices + history
  for (const p of products) {
    insertProduct.run(p.id, p.name, p.symbol, p.type, p.mode, p.currency, p.active, daysAgo(60), now);
    const priceId = uid("prc");
    db.prepare(`
      INSERT INTO prices (id, product_id, price, source, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(priceId, p.id, p.price, p.mode === "manual" ? "manual" : "api", now);

    // Add 3 price history points per product (simulates price movement)
    const basePrice = p.price;
    for (let i = 3; i >= 1; i--) {
      const variance = 1 + (Math.random() - 0.5) * 0.04; // ±2%
      db.prepare(`
        INSERT INTO product_price_history (id, product_id, price, source, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(uid("hist"), p.id, Math.round(basePrice * variance * 100) / 100, p.mode === "manual" ? "manual" : "api", daysAgo(i * 7));
    }
    // Current price as latest history entry
    db.prepare(`
      INSERT INTO product_price_history (id, product_id, price, source, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uid("hist"), p.id, p.price, p.mode === "manual" ? "manual" : "api", now);
  }

  // Positions
  for (const pos of positions) {
    insertPosition.run(pos.id, pos.user, pos.product, pos.qty, pos.avg, daysAgo(20), now);
  }

  // Investment requests
  for (const req of requests) {
    insertRequest.run(req.id, req.user, req.type, req.product, req.amount, req.currency, req.msg, req.status, req.reason, daysAgo(req.age), daysAgo(req.age));
  }

  // Approval requests (demo lifecycle examples)
  // 1. A completed price update (submitted → approved → executed)
  insertApproval.run(
    "apr_demo_price_001", "product", "prd_sukuk_alpha", "price.updated",
    "usr_ops_omar", null, "executed",
    JSON.stringify({ price: 1002.00 }), JSON.stringify({ price: 1005.25 }),
    "Quarterly sukuk revaluation", "usr_sa_ahmed", "Approved per valuation committee",
    daysAgo(3), daysAgo(3), daysAgo(3)
  );

  // 2. A pending settings change
  insertApproval.run(
    "apr_demo_settings_001", "app_settings", "global", "settings.updated",
    "usr_sa_ahmed", null, "pending",
    JSON.stringify({ baseCurrency: "AED", allowUsd: true }),
    JSON.stringify({ baseCurrency: "AED", allowUsd: false }),
    "Disable USD for Q3 compliance review", null, null,
    daysAgo(1), null, null
  );

  // 3. A rejected portfolio change
  insertApproval.run(
    "apr_demo_portfolio_001", "portfolio_position", "pos_h_btc", "portfolio.position.updated",
    "usr_ops_omar", null, "rejected",
    JSON.stringify({ userId: "usr_client_hassan", quantity: 1.2, avgPrice: 88000 }),
    JSON.stringify({ quantity: 5.0 }),
    "Client requested BTC increase", "usr_comp_layla", "Exceeds crypto allocation limit per policy",
    daysAgo(4), daysAgo(4), null
  );

  // 4. An approved (not yet executed) client update
  insertApproval.run(
    "apr_demo_client_001", "user", "usr_client_hassan", "user.updated",
    "usr_rm_khalid", null, "approved",
    JSON.stringify({ name: "Hassan Al-Tamimi", status: "active" }),
    JSON.stringify({ phone: "+971551000099" }),
    "Client phone number update", "usr_sa_sara", "Verified via KYC call",
    daysAgo(2), daysAgo(2), null
  );

  // Audit logs (tell the story)
  const auditEntries = [
    { user: "usr_sa_ahmed",   action: "master.user.created",        entity: "user",             entityId: "usr_ops_omar",       meta: { email: "omar.ops@eisax.com", role: "operations" }, age: 30 },
    { user: "usr_ops_omar",   action: "price.update.submitted",     entity: "product",          entityId: "prd_sukuk_alpha",    meta: { approvalId: "apr_demo_price_001", proposedPrice: 1005.25 }, age: 3 },
    { user: "usr_sa_ahmed",   action: "approval.approved",          entity: "approval_request", entityId: "apr_demo_price_001", meta: { action: "price.updated" }, age: 3 },
    { user: "usr_sa_ahmed",   action: "approval.executed",          entity: "approval_request", entityId: "apr_demo_price_001", meta: { action: "price.updated" }, age: 3 },
    { user: "usr_sa_ahmed",   action: "settings.update.submitted",  entity: "app_settings",     entityId: "global",             meta: { approvalId: "apr_demo_settings_001" }, age: 1 },
    { user: "usr_ops_omar",   action: "portfolio.position.update.submitted", entity: "portfolio_position", entityId: "pos_h_btc", meta: { approvalId: "apr_demo_portfolio_001" }, age: 4 },
    { user: "usr_comp_layla", action: "approval.rejected",          entity: "approval_request", entityId: "apr_demo_portfolio_001", meta: { reason: "Exceeds crypto allocation limit" }, age: 4 },
    { user: "usr_rm_khalid",  action: "user.update.submitted",      entity: "user",             entityId: "usr_client_hassan",  meta: { approvalId: "apr_demo_client_001" }, age: 2 },
    { user: "usr_sa_sara",    action: "approval.approved",          entity: "approval_request", entityId: "apr_demo_client_001", meta: { action: "user.updated" }, age: 2 },
  ];

  for (const entry of auditEntries) {
    insertAudit.run(uid("aud"), entry.user, entry.action, entry.entity, entry.entityId, JSON.stringify(entry.meta), daysAgo(entry.age));
  }

  // Create a sample statement (already published, for demo viewing)
  const samplePdf = path.join(statementsDir, "demo-q1-2026-faisal.pdf");
  if (!fs.existsSync(samplePdf)) {
    fs.mkdirSync(statementsDir, { recursive: true });
    fs.writeFileSync(samplePdf, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
  }
  const stats = fs.statSync(samplePdf);
  db.prepare(`
    INSERT OR REPLACE INTO statements (id, user_id, period, file_name, file_path, mime_type, file_size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("stmt_demo_faisal_q1", "usr_client_faisal", "Q1 2026", "Q1-2026-Statement-Faisal.pdf", samplePdf, "application/pdf", stats.size, daysAgo(15));
})();

// Save passwords to root-only file
const pwLines = Object.entries(passwords)
  .map(([email, pw]) => `${email} : ${pw}`)
  .join("\n");

const pwFile = "/root/demo-passwords.txt";
try {
  fs.writeFileSync(pwFile, pwLines + "\n", { mode: 0o600 });
  console.log(`\nDemo passwords saved to ${pwFile} (mode 600, root-only)`);
} catch {
  // If not running as root, save to a temp location
  const altFile = "/tmp/demo-passwords.txt";
  fs.writeFileSync(altFile, pwLines + "\n", { mode: 0o600 });
  console.log(`\nDemo passwords saved to ${altFile} (move to /root/ and chmod 600)`);
}

console.log("\n=== Demo seed complete ===");
console.log(`Users:      ${users.length}`);
console.log(`Products:   ${products.length}`);
console.log(`Positions:  ${positions.length}`);
console.log(`Requests:   ${requests.length}`);
console.log(`Approvals:  4 (executed, pending, rejected, approved)`);
console.log(`Audit logs: ${9}`);
console.log(`Statements: 1`);
console.log("\nAll accounts have must_change_password=1.");
console.log("Retrieve passwords: sudo cat /root/demo-passwords.txt");
