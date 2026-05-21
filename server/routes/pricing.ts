import { Router } from "express";
import { z } from "zod";
import { db, nowIso, uid } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";

export const pricingRouter = Router();

const priceSchema = z.object({
  price: z.coerce.number().nonnegative()
});

pricingRouter.use(authenticate, requireAdmin);

pricingRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        p.id AS productId,
        p.name AS productName,
        p.type,
        p.pricing_mode AS pricingMode,
        p.currency,
        p.is_active AS isActive,
        pr.id AS priceId,
        pr.price,
        pr.source,
        pr.updated_at AS updatedAt
      FROM products p
      LEFT JOIN prices pr ON pr.product_id = p.id
      ORDER BY p.type, p.name
      `
    )
    .all();

  res.json({ pricing: rows });
});

pricingRouter.patch("/:productId", (req, res, next) => {
  try {
    const body = priceSchema.parse(req.body);
    const admin = (req as unknown as AuthedRequest).user;
    const product = db
      .prepare("SELECT id, pricing_mode FROM products WHERE id = ?")
      .get(req.params.productId) as { id: string; pricing_mode: string } | undefined;

    if (!product) throw new ApiError(404, "Product not found", "product_not_found");
    if (product.pricing_mode !== "manual") {
      throw new ApiError(400, "Only manual-priced products can be updated here", "manual_price_required");
    }

    const timestamp = nowIso();
    const priceId = uid("prc");

    db.transaction(() => {
      db.prepare(
        `
        INSERT INTO prices (id, product_id, price, source, updated_at)
        VALUES (?, ?, ?, 'manual', ?)
        ON CONFLICT(product_id) DO UPDATE SET
          price = excluded.price,
          source = excluded.source,
          updated_at = excluded.updated_at
        `
      ).run(priceId, req.params.productId, body.price, timestamp);

      db.prepare(
        `
        INSERT INTO product_price_history (id, product_id, price, source, created_at)
        VALUES (?, ?, ?, 'manual', ?)
        `
      ).run(uid("hist"), req.params.productId, body.price, timestamp);
    })();

    auditLog(admin, "price.updated", "product", req.params.productId, { price: body.price });
    res.json({ productId: req.params.productId, price: body.price, source: "manual", updatedAt: timestamp });
  } catch (error) {
    next(error);
  }
});
