import type { AuthUser } from "../../lib/types/domain.js";
import { db, nowIso, uid } from "../db/connection.js";

export function auditLog(
  admin: AuthUser,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
) {
  if (admin.role === "client") return;

  db.prepare(`
    INSERT INTO audit_logs (id, admin_user_id, action, entity_type, entity_id, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uid("aud"), admin.id, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null, nowIso());
}
