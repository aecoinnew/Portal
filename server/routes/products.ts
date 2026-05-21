import { Router } from "express";
import { z } from "zod";
import { db, nowIso, uid } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import { mapProduct } from "../services/mappers.js";
import { isCurrencyAllowed } from "./settings.js";

export const productsRouter = Router();

const productSchema = z.object({
  name: z.string().min(2),
  symbol: z.string().optional().nullable(),
  type: z.enum(["stock", "crypto", "fund", "sukuk", "private"]),
  pricingMode: z.enum(["api", "manual"]),
  currency: z.enum(["AED", "USD"]).default("AED"),
  isActive: z.boolean().default(true)
});

const productPatchSchema = productSchema.partial();

productsRouter.use(authenticate);

productsRouter.get("/", (req, res) => {
  const user = (req as AuthedRequest).user;
  const includeInactive = user.role === "admin" && req.query.includeInactive === "true";
  const rows = db
    .prepare(
      `
      SELECT id, name, symbol, type, pricing_mode, currency, is_active, created_at, updated_at
      FROM products
      ${includeInactive ? "" : "WHERE is_active = 1"}
      ORDER BY type, name
      `
    )
    .all() as Array<Record<string, unknown>>;

  res.json({ products: rows.map(mapProduct) });
});

productsRouter.post("/", requireAdmin, (req, res, next) => {
  try {
    const body = productSchema.parse(req.body);
    if (!isCurrencyAllowed(body.currency)) {
      throw new ApiError(400, "USD is disabled in admin settings", "currency_disabled");
    }
    const admin = (req as AuthedRequest).user;
    const id = uid("prd");
    const timestamp = nowIso();

    db.prepare(
      `
      INSERT INTO products (id, name, symbol, type, pricing_mode, currency, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      id,
      body.name,
      body.symbol ?? null,
      body.type,
      body.pricingMode,
      body.currency.toUpperCase(),
      body.isActive ? 1 : 0,
      timestamp,
      timestamp
    );

    auditLog(admin, "product.created", "product", id, body);
    const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as Record<string, unknown>;
    res.status(201).json({ product: mapProduct(row) });
  } catch (error) {
    next(error);
  }
});

productsRouter.patch("/:id", requireAdmin, (req, res, next) => {
  try {
    const body = productPatchSchema.parse(req.body);
    if (body.currency && !isCurrencyAllowed(body.currency)) {
      throw new ApiError(400, "USD is disabled in admin settings", "currency_disabled");
    }
    const admin = (req as AuthedRequest).user;
    const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
    if (!existing) throw new ApiError(404, "Product not found", "product_not_found");

    const updates: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      updates.push(`${column} = ?`);
      values.push(value);
    };

    if (body.name !== undefined) set("name", body.name);
    if (body.symbol !== undefined) set("symbol", body.symbol);
    if (body.type !== undefined) set("type", body.type);
    if (body.pricingMode !== undefined) set("pricing_mode", body.pricingMode);
    if (body.currency !== undefined) set("currency", body.currency.toUpperCase());
    if (body.isActive !== undefined) set("is_active", body.isActive ? 1 : 0);

    if (updates.length > 0) {
      set("updated_at", nowIso());
      db.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`).run(...values, req.params.id);
      auditLog(admin, "product.updated", "product", req.params.id, { fields: Object.keys(body) });
    }

    const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) as Record<string, unknown>;
    res.json({ product: mapProduct(row) });
  } catch (error) {
    next(error);
  }
});
