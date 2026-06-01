import { Router } from "express";
import { db } from "../db/connection.js";
import {
  authenticate,
  canApproveRequests,
  type AuthedRequest
} from "../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

// GET /api/notifications/summary
// Returns counts of items needing the current user's attention, scoped by role.
// Cheap COUNT queries; safe to poll periodically from the client.
notificationsRouter.get("/summary", (req, res) => {
  const user = (req as unknown as AuthedRequest).user;
  const items: Array<{ key: string; label: string; count: number; href: string }> = [];

  // Pending approvals: visible to roles that can approve (or view) them.
  const canSeeApprovals =
    canApproveRequests(user.role) ||
    ["super_admin", "admin", "compliance", "auditor", "relationship_manager"].includes(user.role);

  if (canSeeApprovals) {
    let pendingApprovals = 0;
    if (user.role === "relationship_manager") {
      pendingApprovals = (
        db
          .prepare(
            "SELECT COUNT(*) AS n FROM approval_requests WHERE status = 'pending' AND requested_by_user_id = ?"
          )
          .get(user.id) as { n: number }
      ).n;
    } else {
      pendingApprovals = (
        db.prepare("SELECT COUNT(*) AS n FROM approval_requests WHERE status = 'pending'").get() as {
          n: number;
        }
      ).n;
    }
    items.push({
      key: "approvals",
      label: "Pending approvals",
      count: pendingApprovals,
      href: "/admin/approvals"
    });
  }

  // Pending password reset requests: super_admin only (they action them).
  if (user.role === "super_admin") {
    const pendingResets = (
      db
        .prepare("SELECT COUNT(*) AS n FROM password_reset_requests WHERE status = 'pending'")
        .get() as { n: number }
    ).n;
    items.push({
      key: "password_resets",
      label: "Password reset requests",
      count: pendingResets,
      href: "/admin/master"
    });
  }

  const total = items.reduce((sum, i) => sum + i.count, 0);
  res.json({ total, items });
});
