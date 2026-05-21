import { Router } from "express";
import { z } from "zod";
import { db } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import { submitForApproval } from "../services/approvalExecutor.js";

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

// Phase 3: enforced maker-checker. Returns 202 + approval (pending), does NOT update price.
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

    const oldPrice = db
      .prepare("SELECT price FROM prices WHERE product_id = ?")
      .get(req.params.productId) as { price: number } | undefined;

    const approval = submitForApproval({
      entityType: "product",
      entityId: req.params.productId,
      action: "price.updated",
      requestedBy: admin,
      beforePayload: oldPrice ? { price: oldPrice.price } : null,
      afterPayload: { price: body.price },
      reason: `Price update from ${oldPrice?.price ?? "N/A"} to ${body.price}`
    });

    auditLog(admin, "price.update.submitted", "product", req.params.productId, {
      approvalId: approval.id,
      proposedPrice: body.price
    });

    res.status(202).json({
      pending: true,
      approvalId: approval.id,
      message: "Price update submitted for approval. Action will execute after approval."
    });
  } catch (error) {
    next(error);
  }
});
