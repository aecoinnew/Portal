import { db, nowIso, uid } from "../db/connection.js";
import type { ApprovalRequest, ApprovalStatus, UserRole, AuthUser } from "../../lib/types/domain.js";
import { auditLog } from "./auditService.js";

type ApprovalRow = Record<string, unknown>;

export function serializeBeforeAfter(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

export function createApprovalRequest(params: {
  entityType: string;
  entityId: string;
  action: string;
  requestedBy: AuthUser;
  assignedRole?: UserRole | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string | null;
}): ApprovalRequest {
  const id = uid("apr");
  const timestamp = nowIso();

  db.prepare(
    `
    INSERT INTO approval_requests
    (id, entity_type, entity_id, action, requested_by_user_id, assigned_role, status,
     before_value, after_value, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `
  ).run(
    id,
    params.entityType,
    params.entityId,
    params.action,
    params.requestedBy.id,
    params.assignedRole ?? null,
    serializeBeforeAfter(params.beforeValue),
    serializeBeforeAfter(params.afterValue),
    params.reason ?? null,
    timestamp
  );

  auditLog(params.requestedBy, "approval.created", "approval_request", id, {
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action
  });

  return {
    id,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    requestedByUserId: params.requestedBy.id,
    assignedRole: params.assignedRole ?? null,
    status: "pending",
    beforeValue: serializeBeforeAfter(params.beforeValue),
    afterValue: serializeBeforeAfter(params.afterValue),
    reason: params.reason ?? null,
    decisionByUserId: null,
    decisionReason: null,
    createdAt: timestamp,
    decidedAt: null,
    executedAt: null
  };
}

export function listApprovalRequests(filters: {
  status?: ApprovalStatus | null;
  entityType?: string | null;
  userId?: string | null;
  limit?: number;
}): ApprovalRequest[] {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filters.status) {
    conditions.push("ar.status = ?");
    values.push(filters.status);
  }
  if (filters.entityType) {
    conditions.push("ar.entity_type = ?");
    values.push(filters.entityType);
  }
  if (filters.userId) {
    conditions.push("ar.requested_by_user_id = ?");
    values.push(filters.userId);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 100;

  const rows = db
    .prepare(
      `
      SELECT
        ar.*,
        req.name AS requested_by_name,
        dec.name AS decision_by_name
      FROM approval_requests ar
      LEFT JOIN users req ON req.id = ar.requested_by_user_id
      LEFT JOIN users dec ON dec.id = ar.decision_by_user_id
      ${where}
      ORDER BY ar.created_at DESC
      LIMIT ?
      `
    )
    .all(...values, limit) as ApprovalRow[];

  return rows.map(mapApproval);
}

export function getApprovalRequest(id: string): ApprovalRequest | null {
  const row = db
    .prepare(
      `
      SELECT
        ar.*,
        req.name AS requested_by_name,
        dec.name AS decision_by_name
      FROM approval_requests ar
      LEFT JOIN users req ON req.id = ar.requested_by_user_id
      LEFT JOIN users dec ON dec.id = ar.decision_by_user_id
      WHERE ar.id = ?
      `
    )
    .get(id) as ApprovalRow | undefined;

  return row ? mapApproval(row) : null;
}

export class ApprovalSelfActionError extends Error {
  code = "approval_self_action_forbidden";
}

export function approveApprovalRequest(
  id: string,
  decisionBy: AuthUser,
  decisionReason?: string | null
): ApprovalRequest | null {
  const existing = getApprovalRequest(id);
  if (!existing) return null;
  if (existing.status !== "pending") return null;
  // Maker-checker: the requester cannot approve their own request.
  if (existing.requestedByUserId === decisionBy.id) {
    throw new ApprovalSelfActionError(
      "You cannot approve a request you submitted."
    );
  }

  const timestamp = nowIso();

  db.prepare(
    `
    UPDATE approval_requests
    SET status = 'approved', decision_by_user_id = ?, decision_reason = ?, decided_at = ?
    WHERE id = ?
    `
  ).run(decisionBy.id, decisionReason ?? null, timestamp, id);

  auditLog(decisionBy, "approval.approved", "approval_request", id, {
    entityType: existing.entityType,
    entityId: existing.entityId,
    action: existing.action
  });

  return getApprovalRequest(id);
}

export function rejectApprovalRequest(
  id: string,
  decisionBy: AuthUser,
  decisionReason?: string | null
): ApprovalRequest | null {
  const existing = getApprovalRequest(id);
  if (!existing) return null;
  if (existing.status !== "pending") return null;
  // Maker-checker: the requester cannot reject their own request.
  if (existing.requestedByUserId === decisionBy.id) {
    throw new ApprovalSelfActionError(
      "You cannot reject a request you submitted."
    );
  }

  const timestamp = nowIso();

  db.prepare(
    `
    UPDATE approval_requests
    SET status = 'rejected', decision_by_user_id = ?, decision_reason = ?, decided_at = ?
    WHERE id = ?
    `
  ).run(decisionBy.id, decisionReason ?? null, timestamp, id);

  auditLog(decisionBy, "approval.rejected", "approval_request", id, {
    entityType: existing.entityType,
    entityId: existing.entityId,
    action: existing.action
  });

  const updated = getApprovalRequest(id);
  if (updated) quarantineSweepIfNeeded(updated);
  return updated;
}

export function markApprovalExecuted(id: string, executedBy: AuthUser): ApprovalRequest | null {
  const existing = getApprovalRequest(id);
  if (!existing) return null;
  if (existing.status !== "approved") return null;
  // Maker-checker: the requester cannot execute their own request.
  if (existing.requestedByUserId === executedBy.id) {
    throw new ApprovalSelfActionError(
      "You cannot execute a request you submitted."
    );
  }

  const timestamp = nowIso();

  db.prepare(
    `
    UPDATE approval_requests
    SET status = 'executed', executed_at = ?
    WHERE id = ?
    `
  ).run(timestamp, id);

  auditLog(executedBy, "approval.executed", "approval_request", id, {
    entityType: existing.entityType,
    entityId: existing.entityId,
    action: existing.action
  });

  return getApprovalRequest(id);
}



/**
 * If an approval for a statement upload is rejected or cancelled, delete the
 * file left in quarantine so it doesn't accumulate. Best-effort - errors are
 * logged but do not fail the rejection.
 */
function quarantineSweepIfNeeded(approval: ApprovalRequest) {
  if (approval.action !== "statement.uploaded") return;
  try {
    const after = approval.afterValue ? JSON.parse(approval.afterValue) : null;
    const qp: string | undefined = after?.quarantinePath;
    if (!qp) return;
    // Lazy import to avoid circular deps with db/connection
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const resolved = path.resolve(qp);
    // Only delete if inside known quarantine dir prefix (defense in depth)
    if (!resolved.includes(path.sep + ".quarantine" + path.sep)) return;
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
    }
  } catch (err) {
    console.error(JSON.stringify({
      level: "error",
      code: "quarantine_sweep_failed",
      approvalId: approval.id,
      message: (err as Error)?.message ?? "unknown"
    }));
  }
}

function mapApproval(row: ApprovalRow): ApprovalRequest {
  return {
    id: String(row.id),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    action: String(row.action),
    requestedByUserId: String(row.requested_by_user_id),
    requestedByName: (row.requested_by_name as string | null) ?? undefined,
    assignedRole: (row.assigned_role as string | null) ?? null,
    status: row.status as ApprovalStatus,
    beforeValue: (row.before_value as string | null) ?? null,
    afterValue: (row.after_value as string | null) ?? null,
    reason: (row.reason as string | null) ?? null,
    decisionByUserId: (row.decision_by_user_id as string | null) ?? null,
    decisionByName: (row.decision_by_name as string | null) ?? undefined,
    decisionReason: (row.decision_reason as string | null) ?? null,
    createdAt: String(row.created_at),
    decidedAt: (row.decided_at as string | null) ?? null,
    executedAt: (row.executed_at as string | null) ?? null
  };
}
