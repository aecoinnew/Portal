import { Router } from "express";
import { z } from "zod";
import type { AuthUser } from "../../lib/types/domain.js";
import { authenticate, requirePermission, canViewAudit, canApproveRequests, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import {
  listApprovalRequests,
  getApprovalRequest,
  approveApprovalRequest,
  rejectApprovalRequest,
  ApprovalSelfActionError
} from "../services/approvalService.js";
import { executeApprovedRequest } from "../services/approvalExecutor.js";

export const approvalsRouter = Router();

const decisionSchema = z.object({
  reason: z.string().max(2000).optional().nullable()
});

approvalsRouter.use(authenticate);

approvalsRouter.get("/", (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : null;

    if (!canViewAudit(user.role) && user.role !== "operations" && user.role !== "finance" && user.role !== "relationship_manager") {
      throw new ApiError(403, "Insufficient permissions to view approvals", "forbidden");
    }

    let userId: string | null = null;
    if (user.role === "relationship_manager") {
      userId = user.id;
    }

    const approvals = listApprovalRequests({
      status: status as "pending" | "approved" | "rejected" | "cancelled" | "executed" | null,
      entityType,
      userId
    });

    res.json({ approvals });
  } catch (error) {
    if (error instanceof ApprovalSelfActionError) {
      return next(new ApiError(403, error.message, error.code));
    }
    next(error);
  }
});

approvalsRouter.get("/:id", (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const approval = getApprovalRequest(req.params.id);

    if (!approval) {
      throw new ApiError(404, "Approval request not found", "approval_not_found");
    }

    if (approval.requestedByUserId !== user.id && !canViewAudit(user.role)) {
      throw new ApiError(403, "Cannot view another user's approval request", "forbidden");
    }

    res.json({ approval });
  } catch (error) {
    if (error instanceof ApprovalSelfActionError) {
      return next(new ApiError(403, error.message, error.code));
    }
    next(error);
  }
});

approvalsRouter.post("/:id/approve", requirePermission(canApproveRequests, "approve_requests"), (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    const user = (req as unknown as AuthedRequest).user;
    const approval = approveApprovalRequest(req.params.id, user, body.reason ?? null);

    if (!approval) {
      throw new ApiError(400, "Approval request cannot be approved", "approval_invalid_state");
    }

    res.json({ approval });
  } catch (error) {
    if (error instanceof ApprovalSelfActionError) {
      return next(new ApiError(403, error.message, error.code));
    }
    next(error);
  }
});

approvalsRouter.post("/:id/reject", requirePermission(canApproveRequests, "approve_requests"), (req, res, next) => {
  try {
    const body = decisionSchema.parse(req.body);
    const user = (req as unknown as AuthedRequest).user;
    const approval = rejectApprovalRequest(req.params.id, user, body.reason ?? null);

    if (!approval) {
      throw new ApiError(400, "Approval request cannot be rejected", "approval_invalid_state");
    }

    res.json({ approval });
  } catch (error) {
    if (error instanceof ApprovalSelfActionError) {
      return next(new ApiError(403, error.message, error.code));
    }
    next(error);
  }
});

approvalsRouter.post("/:id/execute", requirePermission(canApproveRequests, "approve_requests"), (req, res, next) => {
  try {
    const user = (req as unknown as AuthedRequest).user;
    const out = executeApprovedRequest(req.params.id, user);
    if (out.alreadyExecuted) {
      // Idempotent: already executed previously
      return res.json({ approval: out.approval, alreadyExecuted: true });
    }
    res.json({ approval: out.approval, result: out.result });
  } catch (error) {
    if (error instanceof ApprovalSelfActionError) {
      return next(new ApiError(403, error.message, error.code));
    }
    next(error);
  }
});
