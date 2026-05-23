import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import { submitForApproval } from "../services/approvalExecutor.js";
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
  const includeInactive = user.role !== "client" && req.query.includeInactive === "true";
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

// Phase 3 extension: product creation requires maker-checker approval.
productsRouter.post("/", requireAdmin, (req, res, next) => {
  try {
    const body = productSchema.parse(req.body);
    if (!isCurrencyAllowed(body.currency)) {
      throw new ApiError(400, "USD is disabled in admin settings", "currency_disabled");
    }
    const admin = (req as AuthedRequest).user;
    const productId = uid("prd");

    const approval = submitForApproval({
      entityType: "product",
      entityId: productId,
      action: "product.created",
      requestedBy: admin,
      beforePayload: null,
      afterPayload: {
        name: body.name,
        symbol: body.symbol ?? null,
        type: body.type,
        pricingMode: body.pricingMode,
        currency: body.currency,
        isActive: body.isActive
      },
      reason: `Create product: ${body.name} (${body.type}, ${body.pricingMode})`
    });

    auditLog(admin, "product.create.submitted", "product", productId, {
      approvalId: approval.id,
      name: body.name,
      pricingMode: body.pricingMode
    });

    res.status(202).json({ pending: true, approvalId: approval.id, productId });
  } catch (error) {
    next(error);
  }
});

// Phase 3 extension: product config changes require maker-checker approval.
// This governs: pricing_mode, symbol, currency, type, is_active, name.
productsRouter.patch("/:id", requireAdmin, (req, res, next) => {
  try {
    const body = productPatchSchema.parse(req.body);
    if (body.currency && !isCurrencyAllowed(body.currency)) {
      throw new ApiError(400, "USD is disabled in admin settings", "currency_disabled");
    }
    const admin = (req as AuthedRequest).user;
    const existing = db
      .prepare("SELECT id, name, symbol, type, pricing_mode, currency, is_active FROM products WHERE id = ?")
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!existing) throw new ApiError(404, "Product not found", "product_not_found");

    if (Object.keys(body).length === 0) {
      throw new ApiError(400, "No changes provided", "no_changes");
    }

    const approval = submitForApproval({
      entityType: "product",
      entityId: req.params.id,
      action: "product.config.updated",
      requestedBy: admin,
      beforePayload: {
        name: existing.name,
        symbol: existing.symbol,
        type: existing.type,
        pricingMode: existing.pricing_mode,
        currency: existing.currency,
        isActive: Boolean(existing.is_active)
      },
      afterPayload: body,
      reason: `Product config update: ${existing.name} (fields: ${Object.keys(body).join(", ")})`
    });

    auditLog(admin, "product.config.update.submitted", "product", req.params.id, {
      approvalId: approval.id,
      fields: Object.keys(body)
    });

    res.status(202).json({ pending: true, approvalId: approval.id });
  } catch (error) {
    next(error);
  }
});
