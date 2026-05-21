import { Router } from "express";
import { z } from "zod";
import { db, nowIso, uid } from "../db/connection.js";
import { authenticate, requireAdmin, requireSelfOrAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
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

portfolioRouter.post("/positions", requireAdmin, (req, res, next) => {
  try {
    const body = positionSchema.parse(req.body);
    const admin = (req as AuthedRequest).user;
    assertClient(body.userId);
    assertProduct(body.productId);
    const id = uid("pos");
    const timestamp = nowIso();

    db.prepare(
      `
      INSERT INTO portfolio_positions (id, user_id, product_id, quantity, avg_price, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, product_id) DO UPDATE SET
        quantity = excluded.quantity,
        avg_price = excluded.avg_price,
        updated_at = excluded.updated_at
      `
    ).run(id, body.userId, body.productId, body.quantity, body.avgPrice, timestamp, timestamp);

    auditLog(admin, "portfolio.position.upserted", "portfolio_position", id, body);
    res.status(201).json({ portfolio: getPortfolioSummary(body.userId) });
  } catch (error) {
    next(error);
  }
});

portfolioRouter.patch("/positions/:id", requireAdmin, (req, res, next) => {
  try {
    const body = positionPatchSchema.parse(req.body);
    const admin = (req as AuthedRequest).user;
    const existing = db
      .prepare("SELECT id, user_id FROM portfolio_positions WHERE id = ?")
      .get(req.params.id) as { id: string; user_id: string } | undefined;

    if (!existing) throw new ApiError(404, "Position not found", "position_not_found");

    const updates: string[] = [];
    const values: unknown[] = [];
    const set = (column: string, value: unknown) => {
      updates.push(`${column} = ?`);
      values.push(value);
    };

    if (body.userId !== undefined) {
      assertClient(body.userId);
      set("user_id", body.userId);
    }
    if (body.productId !== undefined) {
      assertProduct(body.productId);
      set("product_id", body.productId);
    }
    if (body.quantity !== undefined) set("quantity", body.quantity);
    if (body.avgPrice !== undefined) set("avg_price", body.avgPrice);

    if (updates.length > 0) {
      set("updated_at", nowIso());
      db.prepare(`UPDATE portfolio_positions SET ${updates.join(", ")} WHERE id = ?`).run(...values, req.params.id);
      auditLog(admin, "portfolio.position.updated", "portfolio_position", req.params.id, body);
    }

    res.json({ portfolio: getPortfolioSummary(body.userId ?? existing.user_id) });
  } catch (error) {
    if (String(error).includes("UNIQUE constraint failed")) {
      return next(new ApiError(409, "That client already has this product position", "position_exists"));
    }
    return next(error);
  }
});

portfolioRouter.delete("/positions/:id", requireAdmin, (req, res, next) => {
  try {
    const admin = (req as AuthedRequest).user;
    const existing = db
      .prepare("SELECT id, user_id FROM portfolio_positions WHERE id = ?")
      .get(req.params.id) as { id: string; user_id: string } | undefined;

    if (!existing) throw new ApiError(404, "Position not found", "position_not_found");
    db.prepare("DELETE FROM portfolio_positions WHERE id = ?").run(req.params.id);
    auditLog(admin, "portfolio.position.deleted", "portfolio_position", req.params.id, {
      userId: existing.user_id
    });

    res.status(204).send();
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
