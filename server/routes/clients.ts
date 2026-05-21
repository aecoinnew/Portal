import bcrypt from "bcrypt";
import { Router } from "express";
import { z } from "zod";
import type { UserRole, UserStatus } from "../../lib/types/domain.js";
import { db, uid } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import { submitForApproval } from "../services/approvalExecutor.js";
import { mapClient } from "../services/mappers.js";

export const clientsRouter = Router();
clientsRouter.use(authenticate, requireAdmin);

const userCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(10),
  role: z.enum(["client", "admin"]).default("client"),
  status: z.enum(["active", "suspended"]).default("active"),
  phone: z.string().optional().nullable(),
  relationshipManager: z.string().optional().nullable()
});

const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(10).optional(),
  role: z.enum(["client", "admin"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  phone: z.string().optional().nullable(),
  relationshipManager: z.string().optional().nullable()
});

clientsRouter.get("/", (req, res) => {
  const role = req.query.role === "admin" ? "admin" : "client";
  const rows = db
    .prepare(
      `
      SELECT id, name, email, role, status, phone, relationship_manager, created_at, updated_at
      FROM users
      WHERE role = ?
      ORDER BY name
      `
    )
    .all(role) as Array<Record<string, unknown>>;
  res.json({ clients: rows.map(mapClient) });
});

clientsRouter.post("/", async (req, res, next) => {
  try {
    const body = userCreateSchema.parse(req.body);
    const admin = (req as unknown as AuthedRequest).user;

    // Pre-check uniqueness so we can return 409 immediately rather than failing at execute time.
    const dup = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE").get(body.email);
    if (dup) throw new ApiError(409, "Email already exists", "email_exists");

    const userId = uid("usr");
    // Hash the password BEFORE storing in approval. We never persist plaintext.
    const passwordHash = await bcrypt.hash(body.password, 12);

    const approval = submitForApproval({
      entityType: "user",
      entityId: userId,
      action: "user.created",
      requestedBy: admin,
      beforePayload: null,
      afterPayload: {
        name: body.name,
        email: body.email,
        passwordHash, // hashed - cannot be reversed
        role: body.role,
        status: body.status,
        phone: body.phone ?? null,
        relationshipManager: body.relationshipManager ?? null
      },
      reason: `User create: ${body.email} (role=${body.role})`
    });
    auditLog(admin, "user.create.submitted", "user", userId, {
      approvalId: approval.id,
      email: body.email,
      role: body.role
    });
    res.status(202).json({ pending: true, approvalId: approval.id, userId });
  } catch (error) {
    next(error);
  }
});

clientsRouter.get("/:id", (req, res, next) => {
  const row = db
    .prepare("SELECT id, name, email, role, status, phone, relationship_manager, created_at, updated_at FROM users WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return next(new ApiError(404, "Client not found", "client_not_found"));
  return res.json({ client: mapClient(row) });
});

clientsRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = userUpdateSchema.parse(req.body);
    const admin = (req as unknown as AuthedRequest).user;
    const existing = db
      .prepare("SELECT id, name, email, role, status FROM users WHERE id = ?")
      .get(req.params.id) as
        | { id: string; name: string; email: string; role: UserRole; status: UserStatus }
        | undefined;
    if (!existing) throw new ApiError(404, "Client not found", "client_not_found");

    const after: Record<string, unknown> = {};
    if (body.name !== undefined) after.name = body.name;
    if (body.email !== undefined) {
      if (body.email.toLowerCase() !== existing.email.toLowerCase()) {
        const dup = db.prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?")
          .get(body.email, req.params.id);
        if (dup) throw new ApiError(409, "Email already exists", "email_exists");
      }
      after.email = body.email;
    }
    if (body.role !== undefined) after.role = body.role;
    if (body.status !== undefined) after.status = body.status;
    if (body.phone !== undefined) after.phone = body.phone;
    if (body.relationshipManager !== undefined) after.relationshipManager = body.relationshipManager;
    if (body.password !== undefined) {
      after.passwordHash = await bcrypt.hash(body.password, 12);
    }
    if (Object.keys(after).length === 0) {
      throw new ApiError(400, "No changes provided", "no_changes");
    }

    const approval = submitForApproval({
      entityType: "user",
      entityId: req.params.id,
      action: "user.updated",
      requestedBy: admin,
      beforePayload: {
        name: existing.name,
        email: existing.email,
        role: existing.role,
        status: existing.status
      },
      afterPayload: after,
      reason: `User ${req.params.id} update`
    });
    auditLog(admin, "user.update.submitted", "user", req.params.id, {
      approvalId: approval.id,
      fields: Object.keys(after)
    });
    res.status(202).json({ pending: true, approvalId: approval.id });
  } catch (error) {
    next(error);
  }
});
