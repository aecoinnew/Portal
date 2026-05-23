import bcrypt from "bcrypt";
import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { db, nowIso, uid } from "../db/connection.js";
import { authenticate, requireSuperAdmin, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import type { UserRole, UserStatus } from "../../lib/types/domain.js";

export const masterRouter = Router();

masterRouter.use(authenticate, requireSuperAdmin);

const ALL_ROLES = [
  "super_admin",
  "admin",
  "operations",
  "relationship_manager",
  "compliance",
  "finance",
  "auditor",
  "client"
] as const;

const createUserSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  role: z.enum(ALL_ROLES),
  status: z.enum(["active", "suspended"]).default("active"),
  phone: z.string().max(40).optional().nullable(),
  relationshipManager: z.string().max(120).optional().nullable()
});

const roleSchema = z.object({ role: z.enum(ALL_ROLES) });
const statusSchema = z.object({ status: z.enum(["active", "suspended"]) });

// ------ helpers ------

function getUser(id: string) {
  return db
    .prepare(
      "SELECT id, name, email, role, status, phone, relationship_manager, created_at, updated_at, last_login_at, must_change_password FROM users WHERE id = ?"
    )
    .get(id) as
    | {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        status: UserStatus;
        phone: string | null;
        relationship_manager: string | null;
        created_at: string;
        updated_at: string;
        last_login_at: string | null;
        must_change_password: number;
      }
    | undefined;
}

/**
 * Throws ApiError 409 if applying intent (newRole, newStatus) to targetId would
 * leave zero active super_admins.
 */
function assertNotLastSuperAdmin(targetId: string, newRole: UserRole | null, newStatus: UserStatus | null) {
  const target = getUser(targetId);
  if (!target) return;

  const willStillBeSuperActive =
    (newRole ?? target.role) === "super_admin" && (newStatus ?? target.status) === "active";

  if (target.role === "super_admin" && target.status === "active" && !willStillBeSuperActive) {
    const others = db
      .prepare(
        "SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin' AND status = 'active' AND id != ?"
      )
      .get(targetId) as { n: number };
    if (others.n === 0) {
      throw new ApiError(
        409,
        "Cannot remove the last active super_admin",
        "last_super_admin_protected"
      );
    }
  }
}

function requestId(req: { requestId?: string }) {
  return req.requestId ?? null;
}

// ------ list users ------
masterRouter.get("/users", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT id, name, email, role, status, phone, relationship_manager,
             created_at, updated_at, last_login_at, must_change_password
      FROM users
      ORDER BY role, name
      `
    )
    .all() as Array<Record<string, unknown>>;

  res.json({
    users: rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      status: r.status,
      phone: r.phone,
      relationshipManager: r.relationship_manager,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      lastLoginAt: r.last_login_at ?? null,
      mustChangePassword: Boolean(r.must_change_password)
    }))
  });
});

// ------ create user ------
masterRouter.post("/users", async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body);
    const me = (req as unknown as AuthedRequest).user;

    const dup = db
      .prepare("SELECT id FROM users WHERE email = ? COLLATE NOCASE")
      .get(body.email);
    if (dup) throw new ApiError(409, "Email already exists", "email_exists");

    // Generate a strong temporary password. Caller (super_admin) sees it once.
    const tempPassword = crypto.randomBytes(15).toString("base64url");
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const userId = uid("usr");
    const now = nowIso();

    db.prepare(
      `INSERT INTO users
       (id, name, email, password_hash, role, status, phone, relationship_manager,
        created_at, updated_at, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      userId,
      body.name,
      body.email,
      passwordHash,
      body.role,
      body.status,
      body.phone ?? null,
      body.relationshipManager ?? null,
      now,
      now
    );

    auditLog(me, "master.user.created", "user", userId, {
      email: body.email,
      role: body.role,
      status: body.status,
      requestId: requestId(req as unknown as { requestId?: string })
    });

    const created = getUser(userId);
    res.status(201).json({
      user: {
        id: created!.id,
        email: created!.email,
        role: created!.role,
        status: created!.status,
        mustChangePassword: true
      },
      // tempPassword is shown ONCE in the response. Not stored anywhere else.
      // Communicate it to the user out-of-band immediately.
      tempPassword,
      message:
        "Save this temporary password now. It will not be shown again. Communicate it to the new user via a secure channel."
    });
  } catch (error) {
    next(error);
  }
});

// ------ change role ------
masterRouter.patch("/users/:id/role", (req, res, next) => {
  try {
    const body = roleSchema.parse(req.body);
    const me = (req as unknown as AuthedRequest).user;
    const target = getUser(req.params.id);
    if (!target) throw new ApiError(404, "User not found", "user_not_found");

    if (target.id === me.id) {
      throw new ApiError(403, "Cannot change your own role", "self_role_change_forbidden");
    }
    if (target.role === body.role) {
      return res.json({ user: { id: target.id, role: target.role }, unchanged: true });
    }

    assertNotLastSuperAdmin(target.id, body.role, null);

    db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
      .run(body.role, target.id);

    auditLog(me, "master.user.role_changed", "user", target.id, {
      from: target.role,
      to: body.role,
      requestId: requestId(req as unknown as { requestId?: string })
    });

    const updated = getUser(target.id);
    res.json({ user: { id: updated!.id, role: updated!.role } });
  } catch (error) {
    next(error);
  }
});

// ------ change status (activate / suspend) ------
masterRouter.patch("/users/:id/status", (req, res, next) => {
  try {
    const body = statusSchema.parse(req.body);
    const me = (req as unknown as AuthedRequest).user;
    const target = getUser(req.params.id);
    if (!target) throw new ApiError(404, "User not found", "user_not_found");

    if (target.id === me.id) {
      throw new ApiError(403, "Cannot change your own status", "self_status_change_forbidden");
    }
    if (target.status === body.status) {
      return res.json({ user: { id: target.id, status: target.status }, unchanged: true });
    }

    assertNotLastSuperAdmin(target.id, null, body.status);

    db.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(body.status, target.id);

    auditLog(me, "master.user.status_changed", "user", target.id, {
      from: target.status,
      to: body.status,
      requestId: requestId(req as unknown as { requestId?: string })
    });

    const updated = getUser(target.id);
    res.json({ user: { id: updated!.id, status: updated!.status } });
  } catch (error) {
    next(error);
  }
});

// ------ force password change flag ------
masterRouter.post("/users/:id/force-password-change", (req, res, next) => {
  try {
    const me = (req as unknown as AuthedRequest).user;
    const target = getUser(req.params.id);
    if (!target) throw new ApiError(404, "User not found", "user_not_found");

    db.prepare(
      "UPDATE users SET must_change_password = 1, updated_at = datetime('now') WHERE id = ?"
    ).run(target.id);

    auditLog(me, "master.user.force_password_change", "user", target.id, {
      requestId: requestId(req as unknown as { requestId?: string })
    });
    res.json({ user: { id: target.id }, mustChangePassword: true });
  } catch (error) {
    next(error);
  }
});

// ------ reset password (server-generated temp password, returned ONCE) ------
masterRouter.post("/users/:id/reset-password", async (req, res, next) => {
  try {
    const me = (req as unknown as AuthedRequest).user;
    const target = getUser(req.params.id);
    if (!target) throw new ApiError(404, "User not found", "user_not_found");

    const tempPassword = crypto.randomBytes(15).toString("base64url");
    const hash = await bcrypt.hash(tempPassword, 12);
    db.prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = datetime('now') WHERE id = ?"
    ).run(hash, target.id);

    auditLog(me, "master.user.password_reset", "user", target.id, {
      requestId: requestId(req as unknown as { requestId?: string })
    });

    // tempPassword is never logged or persisted anywhere except as the bcrypt hash above.
    res.json({
      user: { id: target.id, mustChangePassword: true },
      tempPassword,
      message:
        "Save this temporary password now. It will not be shown again. Communicate it to the user via a secure channel."
    });
  } catch (error) {
    next(error);
  }
});

// ------ Reset MFA for a user (account recovery) ------
// Use case: user lost their authenticator device. Super_admin disables MFA so
// the user can log in with password only, then immediately re-enroll.
masterRouter.post("/users/:id/mfa-reset", (req, res, next) => {
  try {
    const me = (req as unknown as AuthedRequest).user;
    const target = getUser(req.params.id);
    if (!target) throw new ApiError(404, "User not found", "user_not_found");

    if (target.id === me.id) {
      throw new ApiError(403, "Use /api/auth/mfa/disable for your own account", "self_mfa_reset_forbidden");
    }

    db.prepare(
      "UPDATE users SET mfa_secret = NULL, mfa_enabled = 0, updated_at = datetime('now') WHERE id = ?"
    ).run(target.id);

    auditLog(me, "master.user.mfa_reset", "user", target.id, {
      requestId: requestId(req as unknown as { requestId?: string })
    });

    res.json({ user: { id: target.id, mfaEnabled: false } });
  } catch (error) {
    next(error);
  }
});
