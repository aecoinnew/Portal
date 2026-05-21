import { Router } from "express";
import { z } from "zod";
import { db, nowIso, uid } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import { mapRequest } from "../services/mappers.js";
import { isCurrencyAllowed } from "./settings.js";

export const requestsRouter = Router();

const createRequestSchema = z.object({
  type: z.enum(["buy", "sell", "subscribe", "withdraw"]),
  productId: z.string().optional().nullable(),
  amount: z.coerce.number().nonnegative().optional().nullable(),
  currency: z.enum(["AED", "USD"]).default("AED"),
  message: z.string().max(2000).optional().default("")
});

const statusSchema = z.object({
  status: z.enum(["approved", "rejected", "executed"]),
  rejectionReason: z.string().max(1000).optional().nullable()
});

requestsRouter.use(authenticate);

requestsRouter.get("/", (req, res) => {
  const user = (req as AuthedRequest).user;
  const status = typeof req.query.status === "string" ? req.query.status : null;
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : null;

  const filters: string[] = [];
  const values: unknown[] = [];

  if (user.role !== "admin") {
    filters.push("ir.user_id = ?");
    values.push(user.id);
  } else if (clientId) {
    filters.push("ir.user_id = ?");
    values.push(clientId);
  }

  if (status) {
    filters.push("ir.status = ?");
    values.push(status);
  }

  const rows = db
    .prepare(
      `
      SELECT
        ir.*,
        u.name AS client_name,
        p.name AS product_name
      FROM investment_requests ir
      JOIN users u ON u.id = ir.user_id
      LEFT JOIN products p ON p.id = ir.product_id
      ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
      ORDER BY ir.created_at DESC
      `
    )
    .all(...values) as Array<Record<string, unknown>>;

  res.json({ requests: rows.map(mapRequest) });
});

requestsRouter.post("/", (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    if (user.role !== "client") {
      throw new ApiError(403, "Only clients can submit investment requests", "client_required");
    }

    const body = createRequestSchema.parse(req.body);
    if (!isCurrencyAllowed(body.currency)) {
      throw new ApiError(400, "USD requests are disabled", "currency_disabled");
    }
    if (body.productId) assertActiveProduct(body.productId);

    const timestamp = nowIso();
    const id = uid("req");

    db.prepare(
      `
      INSERT INTO investment_requests
      (id, user_id, type, product_id, amount, currency, message, status, rejection_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
      `
    ).run(id, user.id, body.type, body.productId ?? null, body.amount ?? null, body.currency, body.message.trim(), timestamp, timestamp);

    const row = db
      .prepare(
        `
        SELECT ir.*, u.name AS client_name, p.name AS product_name
        FROM investment_requests ir
        JOIN users u ON u.id = ir.user_id
        LEFT JOIN products p ON p.id = ir.product_id
        WHERE ir.id = ?
        `
      )
      .get(id) as Record<string, unknown>;

    res.status(201).json({ request: mapRequest(row) });
  } catch (error) {
    next(error);
  }
});

requestsRouter.patch("/:id/status", requireAdmin, (req, res, next) => {
  try {
    const body = statusSchema.parse(req.body);
    const admin = (req as AuthedRequest).user;
    const existing = db.prepare("SELECT id, status FROM investment_requests WHERE id = ?").get(req.params.id) as
      | { id: string; status: string }
      | undefined;

    if (!existing) throw new ApiError(404, "Request not found", "request_not_found");
    if (body.status === "rejected" && !body.rejectionReason?.trim()) {
      throw new ApiError(400, "Rejection reason is required", "rejection_reason_required");
    }

    const timestamp = nowIso();
    db.prepare(
      `
      UPDATE investment_requests
      SET status = ?, rejection_reason = ?, updated_at = ?
      WHERE id = ?
      `
    ).run(body.status, body.status === "rejected" ? body.rejectionReason?.trim() : null, timestamp, req.params.id);

    auditLog(admin, "request.status.updated", "investment_request", req.params.id, {
      from: existing.status,
      to: body.status
    });

    const row = db
      .prepare(
        `
        SELECT ir.*, u.name AS client_name, p.name AS product_name
        FROM investment_requests ir
        JOIN users u ON u.id = ir.user_id
        LEFT JOIN products p ON p.id = ir.product_id
        WHERE ir.id = ?
        `
      )
      .get(req.params.id) as Record<string, unknown>;

    res.json({ request: mapRequest(row) });
  } catch (error) {
    next(error);
  }
});

function assertActiveProduct(productId: string) {
  const row = db.prepare("SELECT id FROM products WHERE id = ? AND is_active = 1").get(productId);
  if (!row) throw new ApiError(400, "Active product not found", "product_not_found");
}
