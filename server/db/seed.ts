import bcrypt from "bcrypt";
import fs from "node:fs";
import path from "node:path";
import { db, nowIso, statementsDir, uid } from "./connection.js";
import "./init.js";

const password = "Emcoin#2026";
const hash = bcrypt.hashSync(password, 12);
const now = nowIso();

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users
  (id, name, email, password_hash, role, status, phone, relationship_manager, created_at, updated_at)
  VALUES (@id, @name, @email, @passwordHash, @role, @status, @phone, @relationshipManager, @createdAt, @updatedAt)
`);

const users = [
  {
    id: "usr_admin_mohammed",
    name: "Mohammed Al-Salem",
    email: "admin@emcoin.local",
    passwordHash: hash,
    role: "admin",
    status: "active",
    phone: "+966500000001",
    relationshipManager: null,
    createdAt: now,
    updatedAt: now
  },
  {
    id: "usr_faisal",
    name: "Faisal Al-Harbi",
    email: "faisal.al-harbi@example.com",
    passwordHash: hash,
    role: "client",
    status: "active",
    phone: "+966500000101",
    relationshipManager: "Mohammed Al-Salem",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "usr_nora",
    name: "Nora Al-Rashidi",
    email: "nora.al-rashidi@example.com",
    passwordHash: hash,
    role: "client",
    status: "active",
    phone: "+966500000102",
    relationshipManager: "Mohammed Al-Salem",
    createdAt: now,
    updatedAt: now
  },
  {
    id: "usr_khalid",
    name: "Khalid Mansouri",
    email: "khalid.mansouri@example.com",
    passwordHash: hash,
    role: "client",
    status: "suspended",
    phone: "+966500000103",
    relationshipManager: "Mohammed Al-Salem",
    createdAt: now,
    updatedAt: now
  }
];

const insertProduct = db.prepare(`
  INSERT OR IGNORE INTO products
  (id, name, symbol, type, pricing_mode, currency, is_active, created_at, updated_at)
  VALUES (@id, @name, @symbol, @type, @pricingMode, @currency, @isActive, @createdAt, @updatedAt)
`);

const products = [
  { id: "prd_aramco", name: "Saudi Aramco", symbol: "2222.SR", type: "stock", pricingMode: "api", currency: "AED", isActive: 1, price: 32.4, source: "api" },
  { id: "prd_sukuk_1", name: "Emcoin Sukuk I", symbol: null, type: "sukuk", pricingMode: "manual", currency: "AED", isActive: 1, price: 1003.5, source: "manual" },
  { id: "prd_btc", name: "Bitcoin", symbol: "BTC-USD", type: "crypto", pricingMode: "api", currency: "AED", isActive: 1, price: 246840, source: "api" },
  { id: "prd_mena_growth", name: "MENA Growth Fund", symbol: null, type: "fund", pricingMode: "manual", currency: "AED", isActive: 1, price: 698.5, source: "manual" },
  { id: "prd_private_eq", name: "Private Equity I", symbol: null, type: "private", pricingMode: "manual", currency: "AED", isActive: 1, price: 196, source: "manual" }
];

const upsertPrice = db.prepare(`
  INSERT INTO prices (id, product_id, price, source, updated_at)
  VALUES (@id, @productId, @price, @source, @updatedAt)
  ON CONFLICT(product_id) DO UPDATE SET
    price = excluded.price,
    source = excluded.source,
    updated_at = excluded.updated_at
`);

const insertHistory = db.prepare(`
  INSERT INTO product_price_history (id, product_id, price, source, created_at)
  VALUES (@id, @productId, @price, @source, @createdAt)
`);

const insertPosition = db.prepare(`
  INSERT OR IGNORE INTO portfolio_positions
  (id, user_id, product_id, quantity, avg_price, created_at, updated_at)
  VALUES (@id, @userId, @productId, @quantity, @avgPrice, @createdAt, @updatedAt)
`);

const insertRequest = db.prepare(`
  INSERT OR IGNORE INTO investment_requests
  (id, user_id, type, product_id, amount, currency, message, status, rejection_reason, created_at, updated_at)
  VALUES (@id, @userId, @type, @productId, @amount, @currency, @message, @status, @rejectionReason, @createdAt, @updatedAt)
`);

const insertStatement = db.prepare(`
  INSERT OR IGNORE INTO statements
  (id, user_id, period, file_name, file_path, mime_type, file_size, created_at)
  VALUES (@id, @userId, @period, @fileName, @filePath, @mimeType, @fileSize, @createdAt)
`);

db.transaction(() => {
  users.forEach((user) => insertUser.run(user));
  products.forEach((product) => {
    insertProduct.run({ ...product, createdAt: now, updatedAt: now });
    upsertPrice.run({
      id: uid("prc"),
      productId: product.id,
      price: product.price,
      source: product.source,
      updatedAt: now
    });
    insertHistory.run({
      id: uid("hist"),
      productId: product.id,
      price: product.price,
      source: product.source,
      createdAt: now
    });
  });

  [
    { id: "pos_faisal_aramco", userId: "usr_faisal", productId: "prd_aramco", quantity: 5000, avgPrice: 28.4 },
    { id: "pos_faisal_sukuk", userId: "usr_faisal", productId: "prd_sukuk_1", quantity: 200, avgPrice: 1010 },
    { id: "pos_faisal_btc", userId: "usr_faisal", productId: "prd_btc", quantity: 0.42, avgPrice: 220000 },
    { id: "pos_faisal_fund", userId: "usr_faisal", productId: "prd_mena_growth", quantity: 1200, avgPrice: 680 },
    { id: "pos_faisal_private", userId: "usr_faisal", productId: "prd_private_eq", quantity: 500, avgPrice: 200 },
    { id: "pos_nora_fund", userId: "usr_nora", productId: "prd_mena_growth", quantity: 1500, avgPrice: 655 },
    { id: "pos_nora_sukuk", userId: "usr_nora", productId: "prd_sukuk_1", quantity: 320, avgPrice: 995 }
  ].forEach((position) => insertPosition.run({ ...position, createdAt: now, updatedAt: now }));

  [
    { id: "req_1048", userId: "usr_faisal", type: "buy", productId: "prd_aramco", amount: 50000, currency: "AED", message: "Please review a buy request for Saudi Aramco.", status: "pending", rejectionReason: null },
    { id: "req_1047", userId: "usr_nora", type: "subscribe", productId: "prd_mena_growth", amount: 200000, currency: "AED", message: "Subscribe to the MENA Growth Fund.", status: "pending", rejectionReason: null },
    { id: "req_1046", userId: "usr_faisal", type: "withdraw", productId: null, amount: 20000, currency: "AED", message: "Requesting a cash withdrawal.", status: "approved", rejectionReason: null },
    { id: "req_1045", userId: "usr_faisal", type: "sell", productId: "prd_sukuk_1", amount: 30000, currency: "AED", message: "Sell a portion of Sukuk holding.", status: "rejected", rejectionReason: "Relationship manager review required." }
  ].forEach((request) => insertRequest.run({ ...request, createdAt: now, updatedAt: now }));

  db.prepare("UPDATE products SET currency = 'AED' WHERE currency = 'SAR'").run();
  db.prepare("UPDATE investment_requests SET currency = 'AED' WHERE currency = 'SAR'").run();
})();

const sampleStatementPath = path.join(statementsDir, "sample-q1-2026.pdf");
if (!fs.existsSync(sampleStatementPath)) {
  fs.writeFileSync(
    sampleStatementPath,
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF"
  );
}

const stats = fs.statSync(sampleStatementPath);
insertStatement.run({
  id: "stmt_faisal_q1_2026",
  userId: "usr_faisal",
  period: "Q1 2026",
  fileName: "Q1 2026 Statement.pdf",
  filePath: sampleStatementPath,
  mimeType: "application/pdf",
  fileSize: stats.size,
  createdAt: now
});

console.log("Seed complete.");
console.log(`Admin: admin@emcoin.local / ${password}`);
console.log(`Client: faisal.al-harbi@example.com / ${password}`);
