import { Router } from "express";
import { db } from "../db/connection.js";
import { authenticate, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { canViewAudit } from "../middleware/auth.js";

export const auditRouter = Router();

auditRouter.use(authenticate);

// Gate: only roles allowed to view the audit trail.
auditRouter.use((req, _res, next) => {
  const user = (req as unknown as AuthedRequest).user;
  if (!canViewAudit(user.role)) {
    return next(new ApiError(403, "Not authorized to view the audit log", "audit_forbidden"));
  }
  next();
});

// GET /api/audit?action=&entityType=&q=&limit=&offset=
auditRouter.get("/", (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
  const offset = Math.max(Number(req.query.offset ?? 0), 0);
  const action = typeof req.query.action === "string" && req.query.action ? req.query.action : null;
  const entityType =
    typeof req.query.entityType === "string" && req.query.entityType ? req.query.entityType : null;
  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : null;

  const where: string[] = [];
  const params: unknown[] = [];
  if (action) {
    where.push("a.action = ?");
    params.push(action);
  }
  if (entityType) {
    where.push("a.entity_type = ?");
    params.push(entityType);
  }
  if (q) {
    where.push("(a.entity_id LIKE ? OR a.metadata LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM audit_logs a LEFT JOIN users u ON u.id = a.admin_user_id ${whereSql}`
      )
      .get(...params) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT a.id, a.admin_user_id, a.action, a.entity_type, a.entity_id, a.metadata, a.created_at,
              u.name AS admin_name, u.email AS admin_email, u.role AS admin_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.admin_user_id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Array<Record<string, unknown>>;

  res.json({
    total,
    limit,
    offset,
    logs: rows.map((r) => {
      let metadata: unknown = null;
      if (r.metadata) {
        try {
          metadata = JSON.parse(r.metadata as string);
        } catch {
          metadata = r.metadata;
        }
      }
      return {
        id: r.id,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        adminId: r.admin_user_id,
        adminName: r.admin_name ?? null,
        adminEmail: r.admin_email ?? null,
        adminRole: r.admin_role ?? null,
        metadata,
        createdAt: r.created_at
      };
    })
  });
});

// GET /api/audit/actions - distinct action + entity types for filter dropdowns
auditRouter.get("/actions", (_req, res) => {
  const actions = (
    db.prepare("SELECT DISTINCT action FROM audit_logs ORDER BY action").all() as Array<{
      action: string;
    }>
  ).map((r) => r.action);
  const entityTypes = (
    db.prepare("SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type").all() as Array<{
      entity_type: string;
    }>
  ).map((r) => r.entity_type);
  res.json({ actions, entityTypes });
});
