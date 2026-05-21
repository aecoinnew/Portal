import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth.js";
import { mapAudit } from "../services/mappers.js";
import { getTotalAum } from "../services/portfolioService.js";
import { db } from "../db/connection.js";

export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

adminRouter.get("/summary", (_req, res) => {
  const users = db
    .prepare(
      `
      SELECT
        COUNT(CASE WHEN role = 'client' THEN 1 END) AS totalClients,
        COUNT(CASE WHEN role = 'client' AND status = 'active' THEN 1 END) AS activeClients,
        COUNT(CASE WHEN role = 'client' AND status = 'suspended' THEN 1 END) AS suspendedClients
      FROM users
      `
    )
    .get() as { totalClients: number; activeClients: number; suspendedClients: number };

  const requests = db
    .prepare("SELECT COUNT(*) AS pendingRequests FROM investment_requests WHERE status = 'pending'")
    .get() as { pendingRequests: number };

  const products = db
    .prepare(
      `
      SELECT
        COUNT(CASE WHEN is_active = 1 THEN 1 END) AS activeProducts,
        COUNT(CASE WHEN is_active = 1 AND pricing_mode = 'manual' THEN 1 END) AS manualProducts
      FROM products
      `
    )
    .get() as { activeProducts: number; manualProducts: number };

  const stale = db
    .prepare(
      `
      SELECT COUNT(*) AS stalePrices
      FROM products p
      LEFT JOIN prices pr ON pr.product_id = p.id
      WHERE p.is_active = 1
        AND p.pricing_mode = 'manual'
        AND (pr.updated_at IS NULL OR datetime(pr.updated_at) < datetime('now', '-24 hours'))
      `
    )
    .get() as { stalePrices: number };

  const activityRows = db
    .prepare(
      `
      SELECT al.*, u.name AS admin_name
      FROM audit_logs al
      JOIN users u ON u.id = al.admin_user_id
      ORDER BY al.created_at DESC
      LIMIT 8
      `
    )
    .all() as Array<Record<string, unknown>>;

  res.json({
    summary: {
      ...users,
      totalAum: getTotalAum(),
      pendingRequests: requests.pendingRequests,
      activeProducts: products.activeProducts,
      manualProducts: products.manualProducts,
      stalePrices: stale.stalePrices,
      recentActivity: activityRows.map(mapAudit)
    }
  });
});
