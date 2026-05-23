import fs from "node:fs";
import path from "node:path";
import { db, nowIso, uid, statementsDir, resolveStatementPath } from "../db/connection.js";
import { auditLog } from "./auditService.js";
import { registerApprovalAction } from "./approvalExecutor.js";
import { ApiError } from "../middleware/error.js";
import type { AppSettings, SupportedCurrency, UserRole, UserStatus } from "../../lib/types/domain.js";

// =====================================================================
// Pricing
// =====================================================================
registerApprovalAction("price.updated", ({ entityId, afterPayload, executor }) => {
  const after = afterPayload as { price: number };
  const product = db
    .prepare("SELECT id, pricing_mode FROM products WHERE id = ?")
    .get(entityId) as { id: string; pricing_mode: string } | undefined;
  if (!product) throw new ApiError(404, "Product not found", "product_not_found");
  if (product.pricing_mode !== "manual") {
    throw new ApiError(400, "Only manual-priced products can be updated", "manual_price_required");
  }

  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO prices (id, product_id, price, source, updated_at)
     VALUES (?, ?, ?, 'manual', ?)
     ON CONFLICT(product_id) DO UPDATE SET
       price = excluded.price,
       source = excluded.source,
       updated_at = excluded.updated_at`
  ).run(uid("prc"), entityId, after.price, timestamp);

  db.prepare(
    `INSERT INTO product_price_history (id, product_id, price, source, created_at)
     VALUES (?, ?, ?, 'manual', ?)`
  ).run(uid("hist"), entityId, after.price, timestamp);

  auditLog(executor, "price.updated.executed", "product", entityId, { price: after.price });
  return { productId: entityId, price: after.price, source: "manual", updatedAt: timestamp };
});

// =====================================================================
// Settings
// =====================================================================
registerApprovalAction("settings.updated", ({ afterPayload, executor }) => {
  const after = afterPayload as { baseCurrency: SupportedCurrency; allowUsd: boolean };
  const timestamp = nowIso();
  db.prepare(
    `UPDATE app_settings SET base_currency = ?, allow_usd = ?, updated_at = ?
     WHERE id = 'global'`
  ).run(after.baseCurrency, after.allowUsd ? 1 : 0, timestamp);

  auditLog(executor, "settings.updated.executed", "app_settings", "global", after);
  const row = db
    .prepare("SELECT base_currency, allow_usd, updated_at FROM app_settings WHERE id = 'global'")
    .get() as { base_currency: SupportedCurrency; allow_usd: 0 | 1; updated_at: string };
  return {
    baseCurrency: row.base_currency,
    allowUsd: Boolean(row.allow_usd),
    updatedAt: row.updated_at
  };
});

// =====================================================================
// Investment requests
// =====================================================================
registerApprovalAction("request.status.updated", ({ entityId, afterPayload, executor }) => {
  const after = afterPayload as { status: string; rejectionReason?: string | null };
  const existing = db
    .prepare("SELECT id, status FROM investment_requests WHERE id = ?")
    .get(entityId) as { id: string; status: string } | undefined;
  if (!existing) throw new ApiError(404, "Request not found", "request_not_found");
  if (existing.status === "executed" || existing.status === "rejected") {
    throw new ApiError(400, `Investment request is already ${existing.status}`, "request_terminal_state");
  }

  const timestamp = nowIso();
  db.prepare(
    `UPDATE investment_requests
     SET status = ?, rejection_reason = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    after.status,
    after.status === "rejected" ? (after.rejectionReason ?? null) : null,
    timestamp,
    entityId
  );
  auditLog(executor, "request.status.updated.executed", "investment_request", entityId, {
    from: existing.status,
    to: after.status
  });
  return { requestId: entityId, status: after.status, updatedAt: timestamp };
});

// =====================================================================
// Portfolio positions
// =====================================================================
type PositionPayload = {
  userId: string;
  productId: string;
  quantity: number;
  avgPrice: number;
};

registerApprovalAction("portfolio.position.upserted", ({ approvalId, entityId, afterPayload, executor }) => {
  const after = afterPayload as PositionPayload;
  // Re-validate referenced entities still exist
  const client = db.prepare("SELECT id FROM users WHERE id=? AND role='client'").get(after.userId);
  if (!client) throw new ApiError(400, "Client not found", "client_not_found");
  const product = db.prepare("SELECT id FROM products WHERE id=?").get(after.productId);
  if (!product) throw new ApiError(400, "Product not found", "product_not_found");

  // Defense in depth: if the (user, product) row already exists with a different id
  // (e.g. submit-time race), refuse rather than leave entity_id dangling.
  const dup = db
    .prepare("SELECT id FROM portfolio_positions WHERE user_id = ? AND product_id = ?")
    .get(after.userId, after.productId) as { id: string } | undefined;
  if (dup && dup.id !== entityId) {
    // Realign approval_requests.entity_id to the real position id, then refuse to insert.
    // This keeps the audit trail honest. entity_id_realigned tag for grep.
    db.prepare("UPDATE approval_requests SET entity_id = ? WHERE id = ?").run(dup.id, approvalId);
    throw new ApiError(
      409,
      "Position already exists for this client and product; use update instead.",
      "position_exists"
    );
  }

  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO portfolio_positions (id, user_id, product_id, quantity, avg_price, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(entityId, after.userId, after.productId, after.quantity, after.avgPrice, timestamp, timestamp);

  auditLog(executor, "portfolio.position.upserted.executed", "portfolio_position", entityId, after);
  return { positionId: entityId, ...after, updatedAt: timestamp };
});

registerApprovalAction("portfolio.position.updated", ({ entityId, afterPayload, executor }) => {
  const after = afterPayload as Partial<PositionPayload>;
  const existing = db
    .prepare("SELECT id, user_id FROM portfolio_positions WHERE id = ?")
    .get(entityId) as { id: string; user_id: string } | undefined;
  if (!existing) throw new ApiError(404, "Position not found", "position_not_found");

  const updates: string[] = [];
  const values: unknown[] = [];
  if (after.userId !== undefined) {
    const client = db.prepare("SELECT id FROM users WHERE id=? AND role='client'").get(after.userId);
    if (!client) throw new ApiError(400, "Client not found", "client_not_found");
    updates.push("user_id = ?"); values.push(after.userId);
  }
  if (after.productId !== undefined) {
    const product = db.prepare("SELECT id FROM products WHERE id=?").get(after.productId);
    if (!product) throw new ApiError(400, "Product not found", "product_not_found");
    updates.push("product_id = ?"); values.push(after.productId);
  }
  if (after.quantity !== undefined) { updates.push("quantity = ?"); values.push(after.quantity); }
  if (after.avgPrice !== undefined) { updates.push("avg_price = ?"); values.push(after.avgPrice); }
  if (updates.length === 0) throw new ApiError(400, "No fields to update", "no_changes");
  updates.push("updated_at = ?"); values.push(nowIso());
  db.prepare(`UPDATE portfolio_positions SET ${updates.join(", ")} WHERE id = ?`).run(...values, entityId);

  auditLog(executor, "portfolio.position.updated.executed", "portfolio_position", entityId, after);
  return { positionId: entityId, fields: Object.keys(after) };
});

registerApprovalAction("portfolio.position.deleted", ({ entityId, executor }) => {
  const existing = db
    .prepare("SELECT id, user_id FROM portfolio_positions WHERE id = ?")
    .get(entityId) as { id: string; user_id: string } | undefined;
  if (!existing) {
    // Idempotent delete: nothing to do
    return { positionId: entityId, alreadyDeleted: true };
  }
  db.prepare("DELETE FROM portfolio_positions WHERE id = ?").run(entityId);
  auditLog(executor, "portfolio.position.deleted.executed", "portfolio_position", entityId, {
    userId: existing.user_id
  });
  return { positionId: entityId, deleted: true };
});

// =====================================================================
// Clients (users)
// =====================================================================
type UserCreatePayload = {
  name: string;
  email: string;
  passwordHash: string; // already-hashed at submission time
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  relationshipManager: string | null;
};

type UserUpdatePayload = Partial<{
  name: string;
  email: string;
  passwordHash: string; // optional: hashed if present
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  relationshipManager: string | null;
}>;

registerApprovalAction("user.created", ({ entityId, afterPayload, executor }) => {
  const after = afterPayload as UserCreatePayload;
  const timestamp = nowIso();
  // Detect collision between submission and execution
  const existing = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(after.email);
  if (existing) throw new ApiError(409, "Email already exists", "email_exists");

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, status, phone, relationship_manager, created_at, updated_at, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  ).run(
    entityId,
    after.name,
    after.email,
    after.passwordHash,
    after.role,
    after.status,
    after.phone,
    after.relationshipManager,
    timestamp,
    timestamp
  );

  auditLog(executor, "user.created.executed", "user", entityId, {
    email: after.email,
    role: after.role,
    status: after.status
  });
  return { userId: entityId, email: after.email, role: after.role };
});

registerApprovalAction("user.updated", ({ entityId, afterPayload, executor }) => {
  const after = afterPayload as UserUpdatePayload;
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(entityId);
  if (!existing) throw new ApiError(404, "User not found", "user_not_found");

  const updates: string[] = [];
  const values: unknown[] = [];
  if (after.name !== undefined) { updates.push("name = ?"); values.push(after.name); }
  if (after.email !== undefined) { updates.push("email = ?"); values.push(after.email); }
  if (after.role !== undefined) { updates.push("role = ?"); values.push(after.role); }
  if (after.status !== undefined) { updates.push("status = ?"); values.push(after.status); }
  if (after.phone !== undefined) { updates.push("phone = ?"); values.push(after.phone); }
  if (after.relationshipManager !== undefined) { updates.push("relationship_manager = ?"); values.push(after.relationshipManager); }
  if (after.passwordHash !== undefined) {
    updates.push("password_hash = ?"); values.push(after.passwordHash);
    updates.push("must_change_password = ?"); values.push(1);
  }
  if (updates.length === 0) throw new ApiError(400, "No fields to update", "no_changes");
  updates.push("updated_at = ?"); values.push(nowIso());
  db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values, entityId);

  auditLog(executor, "user.updated.executed", "user", entityId, { fields: Object.keys(after) });
  return { userId: entityId, fields: Object.keys(after) };
});

// =====================================================================
// Statements (file system + DB)
// =====================================================================
type StatementUploadPayload = {
  userId: string;
  period: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  quarantinePath: string; // absolute path under quarantine dir
};

registerApprovalAction("statement.uploaded", ({ entityId, afterPayload, executor }) => {
  const after = afterPayload as StatementUploadPayload;

  // Verify the quarantined file still exists
  if (!fs.existsSync(after.quarantinePath)) {
    throw new ApiError(404, "Quarantined statement file not found", "statement_file_missing");
  }

  // Sanity: quarantine path must be inside statementsDir/.quarantine
  const resolved = path.resolve(after.quarantinePath);
  if (!resolved.startsWith(statementsDir + path.sep + ".quarantine")) {
    throw new ApiError(400, "Invalid quarantine path", "statement_path_invalid");
  }

  // Move file from quarantine to live dir
  const liveName = path.basename(resolved);
  const livePath = path.join(statementsDir, liveName);
  fs.renameSync(resolved, livePath);

  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO statements (id, user_id, period, file_name, file_path, mime_type, file_size, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(entityId, after.userId, after.period, after.fileName, livePath, after.mimeType, after.fileSize, timestamp);

  auditLog(executor, "statement.uploaded.executed", "statement", entityId, {
    userId: after.userId,
    period: after.period,
    fileName: after.fileName
  });
  return { statementId: entityId, userId: after.userId, period: after.period };
});

registerApprovalAction("statement.deleted", ({ entityId, executor }) => {
  const row = db
    .prepare("SELECT id, user_id, file_path FROM statements WHERE id = ?")
    .get(entityId) as { id: string; user_id: string; file_path: string } | undefined;
  if (!row) {
    return { statementId: entityId, alreadyDeleted: true };
  }
  let resolved: string;
  try {
    resolved = resolveStatementPath(row.file_path);
  } catch {
    resolved = "";
  }
  db.prepare("DELETE FROM statements WHERE id = ?").run(entityId);
  if (resolved && fs.existsSync(resolved)) {
    fs.unlinkSync(resolved);
  }
  auditLog(executor, "statement.deleted.executed", "statement", entityId, { userId: row.user_id });
  return { statementId: entityId, deleted: true };
});


// =====================================================================
// Product configuration (pricing_mode, symbol, currency, type, is_active)
// Phase 3 extension: sensitive product config changes require maker-checker.
// =====================================================================
type ProductConfigPayload = Partial<{
  name: string;
  symbol: string | null;
  type: string;
  pricingMode: string;
  currency: string;
  isActive: boolean;
}>;

registerApprovalAction("product.config.updated", ({ entityId, afterPayload, executor }) => {
  const after = afterPayload as ProductConfigPayload;
  const existing = db
    .prepare("SELECT id FROM products WHERE id = ?")
    .get(entityId) as { id: string } | undefined;
  if (!existing) throw new ApiError(404, "Product not found", "product_not_found");

  const updates: string[] = [];
  const values: unknown[] = [];
  if (after.name !== undefined) { updates.push("name = ?"); values.push(after.name); }
  if (after.symbol !== undefined) { updates.push("symbol = ?"); values.push(after.symbol); }
  if (after.type !== undefined) { updates.push("type = ?"); values.push(after.type); }
  if (after.pricingMode !== undefined) { updates.push("pricing_mode = ?"); values.push(after.pricingMode); }
  if (after.currency !== undefined) { updates.push("currency = ?"); values.push(after.currency); }
  if (after.isActive !== undefined) { updates.push("is_active = ?"); values.push(after.isActive ? 1 : 0); }
  if (updates.length === 0) throw new ApiError(400, "No fields to update", "no_changes");
  updates.push("updated_at = ?"); values.push(nowIso());
  db.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`).run(...values, entityId);

  auditLog(executor, "product.config.updated.executed", "product", entityId, { fields: Object.keys(after) });
  return { productId: entityId, fields: Object.keys(after) };
});

registerApprovalAction("product.created", ({ entityId, afterPayload, executor }) => {
  const after = afterPayload as {
    name: string;
    symbol: string | null;
    type: string;
    pricingMode: string;
    currency: string;
    isActive: boolean;
  };
  // Check for duplicate name
  const dup = db.prepare("SELECT id FROM products WHERE name = ? AND id != ?").get(after.name, entityId);
  if (dup) throw new ApiError(409, "Product name already exists", "product_name_exists");

  db.prepare(
    `INSERT INTO products (id, name, symbol, type, pricing_mode, currency, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(entityId, after.name, after.symbol, after.type, after.pricingMode, after.currency, after.isActive ? 1 : 0, nowIso(), nowIso());

  auditLog(executor, "product.created.executed", "product", entityId, { name: after.name, pricingMode: after.pricingMode });
  return { productId: entityId, name: after.name };
});
