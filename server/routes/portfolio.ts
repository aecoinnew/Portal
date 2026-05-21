import { Router } from "express";
import { z } from "zod";
import { db, uid } from "../db/connection.js";
import { authenticate, requireAdmin, requireSelfOrAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import { submitForApproval } from "../services/approvalExecutor.js";
import { getPortfolioSummary } from "../services/portfolioService.js";

export const portfolioRouter = Router();

const positionSchema = z.object({
  userId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().nonnegative(),
  avgPrice: z.coerce.number().nonnegative()
});

const positionPatchSchema = z.object({
  userId: z.string().min(1).optional(),
  productId: z.string().min(1).optional(),
  quantity: z.coerce.number().nonnegative().optional(),
  avgPrice: z.coerce.number().nonnegative().optional()
});

portfolioRouter.use(authenticate);

portfolioRouter.get("/me", (req, res) => {
  const user = (req as AuthedRequest).user;
  res.json({ portfolio: getPortfolioSummary(user.id) });
});

portfolioRouter.get("/positions", requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        pp.id,
        pp.user_id AS userId,
        u.name AS clientName,
        pp.product_id AS productId,
        p.name AS productName,
        p.type,
        p.currency,
        pp.quantity,
        pp.avg_price AS avgPrice,
        COALESCE(pr.price, 0) AS currentPrice,
        pp.quantity * pp.avg_price AS costBasis,
        pp.quantity * COALESCE(pr.price, 0) AS marketValue,
        pp.quantity * (COALESCE(pr.price, 0) - pp.avg_price) AS unrealizedPnL,
        pp.updated_at AS updatedAt
      FROM portfolio_positions pp
      JOIN users u ON u.id = pp.user_id
      JOIN products p ON p.id = pp.product_id
      LEFT JOIN prices pr ON pr.product_id = pp.product_id
      ORDER BY u.name, p.name
      `
    )
    .all();
  res.json({ positions: rows });
});

// Phase 3: enforced maker-checker. Submission only.
portfolioRouter.post("/positions", requireAdmin, (req, res, next) => {
  try {
    const body = positionSchema.parse(req.body);
    const admin = (req as AuthedRequest).user;
    assertClient(body.userId);
    assertProduct(body.productId);

    // Phase 3.5 fix: if a position already exists for this (user, product),
    // POST is the wrong verb. Return 409 with the existing id so the caller
    // can PATCH instead. This prevents approval_requests.entity_id from
    // pointing to a generated id that ON CONFLICT silently discards.
    const dup = db
      .prepare(
        "SELECT id FROM portfolio_positions WHERE user_id = ? AND product_id = ?"
      )
      .get(body.userId, body.productId) as { id: string } | undefined;
    if (dup) {
      throw new ApiError(
        409,
        "Position already exists for this client and product. Use PATCH /api/portfolio/positions/:id to update.",
        "position_exists",
        { existingPositionId: dup.id }
      );
    }

    // Generate the position id at submit time so the same id is used at execute.
    const positionId = uid("pos");
    const approval = submitForApproval({
      entityType: "portfolio_position",
      entityId: positionId,
      action: "portfolio.position.upserted",
      requestedBy: admin,
      beforePayload: null,
      afterPayload: body,
      reason: `Position create/update for client ${body.userId}`
    });
    auditLog(admin, "portfolio.position.upsert.submitted", "portfolio_position", positionId, {
      approvalId: approval.id,
      userId: body.userId,
      productId: body.productId
    });
    res.status(202).json({ pending: true, approvalId: approval.id, positionId });
  } catch (error) {
    next(error);
  }
});

portfolioRouter.patch("/positions/:id", requireAdmin, (req, res, next) => {
  try {
    const body = positionPatchSchema.parse(req.body);
    const admin = (req as AuthedRequest).user;
    const existing = db
      .prepare("SELECT id, user_id, product_id, quantity, avg_price FROM portfolio_positions WHERE id = ?")
      .get(req.params.id) as
        | { id: string; user_id: string; product_id: string; quantity: number; avg_price: number }
        | undefined;

    if (!existing) throw new ApiError(404, "Position not found", "position_not_found");

    const approval = submitForApproval({
      entityType: "portfolio_position",
      entityId: req.params.id,
      action: "portfolio.position.updated",
      requestedBy: admin,
      beforePayload: {
        userId: existing.user_id,
        productId: existing.product_id,
        quantity: existing.quantity,
        avgPrice: existing.avg_price
      },
      afterPayload: body,
      reason: `Position ${req.params.id} update`
    });
    auditLog(admin, "portfolio.position.update.submitted", "portfolio_position", req.params.id, {
      approvalId: approval.id
    });
    res.status(202).json({ pending: true, approvalId: approval.id });
  } catch (error) {
    next(error);
  }
});

portfolioRouter.delete("/positions/:id", requireAdmin, (req, res, next) => {
  try {
    const admin = (req as AuthedRequest).user;
    const existing = db
      .prepare("SELECT id, user_id, product_id, quantity, avg_price FROM portfolio_positions WHERE id = ?")
      .get(req.params.id) as
        | { id: string; user_id: string; product_id: string; quantity: number; avg_price: number }
        | undefined;

    if (!existing) throw new ApiError(404, "Position not found", "position_not_found");

    const approval = submitForApproval({
      entityType: "portfolio_position",
      entityId: req.params.id,
      action: "portfolio.position.deleted",
      requestedBy: admin,
      beforePayload: {
        userId: existing.user_id,
        productId: existing.product_id,
        quantity: existing.quantity,
        avgPrice: existing.avg_price
      },
      afterPayload: null,
      reason: `Position ${req.params.id} delete`
    });
    auditLog(admin, "portfolio.position.delete.submitted", "portfolio_position", req.params.id, {
      approvalId: approval.id
    });
    res.status(202).json({ pending: true, approvalId: approval.id });
  } catch (error) {
    next(error);
  }
});

portfolioRouter.get("/:userId", requireSelfOrAdmin("userId"), (req, res) => {
  res.json({ portfolio: getPortfolioSummary(req.params.userId) });
});

function assertClient(userId: string) {
  const row = db.prepare("SELECT id FROM users WHERE id = ? AND role = 'client'").get(userId);
  if (!row) throw new ApiError(400, "Client user not found", "client_not_found");
}

function assertProduct(productId: string) {
  const row = db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
  if (!row) throw new ApiError(400, "Product not found", "product_not_found");
}
