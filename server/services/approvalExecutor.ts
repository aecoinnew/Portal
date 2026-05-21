import { db, nowIso } from "../db/connection.js";
import type { AuthUser } from "../../lib/types/domain.js";
import { auditLog } from "./auditService.js";
import { createApprovalRequest, getApprovalRequest } from "./approvalService.js";
import { ApiError } from "../middleware/error.js";

/**
 * Phase 3 (hardened): Enforced maker-checker with atomic claim.
 *
 * Status machine:
 *   pending -> approved -> executing -> executed
 *                       -> rejected
 *           -> cancelled
 *
 * Race-safety:
 *   - Execute uses an atomic UPDATE WHERE status='approved' that returns
 *     changes > 0 only for the winning caller. Loser sees 0 and returns
 *     alreadyExecuted/inProgress.
 *   - Handler runs only after a successful claim.
 *   - On handler error, status reverts to 'approved' (recoverable) with a
 *     structured log entry. We do NOT mark 'executed' on failure.
 */

export type ApprovalActionHandler = (params: {
  approvalId: string;
  entityId: string;
  beforePayload: unknown;
  afterPayload: unknown;
  executor: AuthUser;
}) => unknown;

const handlers = new Map<string, ApprovalActionHandler>();

export function registerApprovalAction(action: string, handler: ApprovalActionHandler) {
  if (handlers.has(action)) {
    console.warn(JSON.stringify({ level: "warn", code: "approval_handler_overwritten", action }));
  }
  handlers.set(action, handler);
}

export function getApprovalHandler(action: string): ApprovalActionHandler | undefined {
  return handlers.get(action);
}

export function submitForApproval(params: {
  entityType: string;
  entityId: string;
  action: string;
  requestedBy: AuthUser;
  beforePayload: unknown;
  afterPayload: unknown;
  reason?: string | null;
}) {
  if (!handlers.has(params.action)) {
    throw new ApiError(
      500,
      `No approval executor registered for action '${params.action}'`,
      "approval_executor_missing"
    );
  }
  return createApprovalRequest({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    requestedBy: params.requestedBy,
    beforeValue: params.beforePayload,
    afterValue: params.afterPayload,
    reason: params.reason ?? null
  });
}

/**
 * Atomically claim an approved approval, run its handler, and mark executed.
 *
 * Returns one of:
 *   { approval, executed: true,  alreadyExecuted: false, result } - this caller ran the handler
 *   { approval, executed: false, alreadyExecuted: true }          - already executed by someone else
 *   { approval, executed: false, alreadyExecuted: false, inProgress: true } - someone else is currently running it
 *
 * Throws on:
 *   - approval not found
 *   - approval not in 'approved' state (and not already executing/executed)
 *   - executor is the original requester (self-action)
 *   - handler error: re-thrown, status reverted to 'approved'
 */
export function executeApprovedRequest(approvalId: string, executor: AuthUser) {
  const existing = getApprovalRequest(approvalId);
  if (!existing) {
    throw new ApiError(404, "Approval request not found", "approval_not_found");
  }

  // Idempotency: already executed
  if (existing.status === "executed") {
    return { approval: existing, executed: false, alreadyExecuted: true } as const;
  }

  // Concurrent execution: someone else just claimed it
  if (existing.status === "executing") {
    return {
      approval: existing,
      executed: false,
      alreadyExecuted: false,
      inProgress: true
    } as const;
  }

  if (existing.status !== "approved") {
    throw new ApiError(
      400,
      `Approval is in status '${existing.status}', cannot execute`,
      "approval_invalid_state"
    );
  }

  if (existing.requestedByUserId === executor.id) {
    throw new ApiError(
      403,
      "You cannot execute a request you submitted.",
      "approval_self_action_forbidden"
    );
  }

  const handler = handlers.get(existing.action);
  if (!handler) {
    throw new ApiError(
      500,
      `No approval executor registered for action '${existing.action}'`,
      "approval_executor_missing"
    );
  }

  // ---- Atomic claim: pending->executing only if currently approved ----
  const claim = db
    .prepare(
      "UPDATE approval_requests SET status='executing' WHERE id=? AND status='approved'"
    )
    .run(approvalId);

  if (claim.changes === 0) {
    // Lost the race - re-read to see who won
    const fresh = getApprovalRequest(approvalId)!;
    if (fresh.status === "executed") {
      return { approval: fresh, executed: false, alreadyExecuted: true } as const;
    }
    return {
      approval: fresh,
      executed: false,
      alreadyExecuted: false,
      inProgress: true
    } as const;
  }

  // ---- We own the claim. Run handler in a transaction; on failure, revert. ----
  const beforePayload = existing.beforeValue ? JSON.parse(existing.beforeValue) : null;
  const afterPayload = existing.afterValue ? JSON.parse(existing.afterValue) : null;

  let result: unknown;
  try {
    const tx = db.transaction(() => {
      result = handler({
        approvalId: existing.id,
        entityId: existing.entityId,
        beforePayload,
        afterPayload,
        executor
      });
      const flip = db
        .prepare(
          "UPDATE approval_requests SET status='executed', executed_at=? WHERE id=? AND status='executing'"
        )
        .run(nowIso(), approvalId);
      if (flip.changes !== 1) {
        // Should be impossible after our claim, but defend anyway.
        throw new Error("Failed to flip status from executing to executed");
      }
    });
    tx();
  } catch (handlerError) {
    // Revert the claim so this approval can be retried.
    db.prepare(
      "UPDATE approval_requests SET status='approved' WHERE id=? AND status='executing'"
    ).run(approvalId);

    const errAny = handlerError as { message?: string; stack?: string; name?: string };
    console.error(
      JSON.stringify({
        level: "error",
        timestamp: new Date().toISOString(),
        code: "approval_handler_failed",
        approvalId,
        action: existing.action,
        executorId: executor.id,
        name: errAny?.name ?? "Error",
        message: errAny?.message ?? "unknown",
        stack: errAny?.stack ?? null
      })
    );
    throw handlerError;
  }

  auditLog(executor, "approval.executed", "approval_request", existing.id, {
    entityType: existing.entityType,
    entityId: existing.entityId,
    action: existing.action
  });

  const updated = getApprovalRequest(existing.id)!;
  return {
    approval: updated,
    executed: true,
    alreadyExecuted: false,
    result
  } as const;
}
