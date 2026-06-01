import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../db/connection.js";
import { ApiError } from "./error.js";
import type { AuthUser, UserRole } from "../../lib/types/domain.js";

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

const jwtPayloadSchema = z.object({
  sub: z.string(),
  role: z.enum(ALL_ROLES)
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "suspended";
  mfa_enabled: number;
};

export type AuthedRequest = Request & {
  user: AuthUser;
};

// Privileged roles must have MFA enabled. Until they enroll, their token is
// accepted ONLY for the endpoints needed to enroll (and to read identity / log out).
const PRIVILEGED_ROLES = new Set<string>([
  "super_admin",
  "admin",
  "operations",
  "relationship_manager",
  "compliance",
  "finance",
  "auditor"
]);

// Paths (relative to the router mount) that an un-enrolled privileged user may hit.
// These are matched against req.path which already excludes the /api prefix only
// inside routers; in the global middleware we match the full originalUrl path.
const MFA_ENROLL_EXEMPT = [
  "/api/auth/me",
  "/api/auth/refresh",
  "/api/auth/mfa/setup",
  "/api/auth/mfa/verify",
  "/api/auth/mfa/state",
  "/api/auth/logout",
  "/api/auth/change-password",
  "/api/health"
];

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return next(new ApiError(401, "Authentication required", "unauthenticated"));
  }

  try {
    const decoded = jwtPayloadSchema.parse(jwt.verify(token, jwtSecret()));
    const row = db
      .prepare("SELECT id, name, email, role, status, mfa_enabled FROM users WHERE id = ?")
      .get(decoded.sub) as UserRow | undefined;

    if (!row) {
      return next(new ApiError(401, "User no longer exists", "unauthenticated"));
    }

    if (row.status === "suspended") {
      return next(new ApiError(403, "Account is suspended", "account_suspended"));
    }

    (req as AuthedRequest).user = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status
    };

    // Enforce MFA enrollment for privileged roles. An un-enrolled privileged
    // user may only reach the enrollment/identity endpoints; everything else
    // is blocked so the second factor cannot be skipped.
    if (PRIVILEGED_ROLES.has(row.role) && row.mfa_enabled !== 1) {
      const path = req.originalUrl.split("?")[0];
      const exempt = MFA_ENROLL_EXEMPT.some((p) => path === p || path.startsWith(p + "/"));
      if (!exempt) {
        return next(
          new ApiError(
            403,
            "Multi-factor authentication enrollment is required before continuing.",
            "mfa_enrollment_required"
          )
        );
      }
    }

    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token", "invalid_token"));
  }
}

/**
 * Strict equality role guard. Use only when EXACTLY one role is allowed.
 * For multi-role guards prefer requireAnyRole(). For permission-style guards
 * prefer requirePermission() + a can* function. There is no role hierarchy:
 * "admin" does NOT imply "operations" etc. - each role is an independent set.
 */
export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user || user.role !== role) {
      return next(new ApiError(403, "Insufficient permissions", "forbidden"));
    }
    return next();
  };
}

export function requireAnyRole(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user || !roles.includes(user.role)) {
      return next(new ApiError(403, "Insufficient permissions", "forbidden"));
    }
    return next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireAnyRole(["super_admin", "admin"])(req, res, next);
}

/**
 * Hard gate: only super_admin role can pass. Used for governance actions
 * (Master Admin Dashboard).
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole("super_admin")(req, res, next);
}

export function requireSelfOrAdmin(paramName = "userId") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    const targetUserId = req.params[paramName] ?? req.query[paramName];
    if (!isAdminRole(user.role) && user.id !== targetUserId) {
      return next(new ApiError(403, "Cannot access another client account", "ownership_required"));
    }
    return next();
  };
}

/**
 * Returns true only for roles that are allowed to access another user's data
 * (used by requireSelfOrAdmin). This is an explicit allowlist - do NOT change
 * to "role !== 'client'" because that would grant cross-account access to
 * auditor / compliance / finance roles which are read-only-by-context.
 */
function isAdminRole(role: UserRole): boolean {
  return ["super_admin", "admin", "operations", "relationship_manager"].includes(role);
}

export function canManageClients(role: UserRole): boolean {
  return ["super_admin", "admin", "operations", "relationship_manager"].includes(role);
}

export function canManageProducts(role: UserRole): boolean {
  return ["super_admin", "admin", "operations", "finance"].includes(role);
}

export function canManagePortfolio(role: UserRole): boolean {
  return ["super_admin", "admin", "operations", "finance", "relationship_manager"].includes(role);
}

export function canManagePricing(role: UserRole): boolean {
  return ["super_admin", "admin", "finance", "operations"].includes(role);
}

export function canManageStatements(role: UserRole): boolean {
  return ["super_admin", "admin", "operations", "finance"].includes(role);
}

export function canApproveRequests(role: UserRole): boolean {
  return ["super_admin", "admin", "operations", "compliance", "finance"].includes(role);
}

export function canViewAudit(role: UserRole): boolean {
  return ["super_admin", "admin", "compliance", "auditor"].includes(role);
}

export function canViewAdminDashboard(role: UserRole): boolean {
  return ["super_admin", "admin", "operations", "compliance", "finance", "auditor"].includes(role);
}

export function requirePermission(
  permissionFn: (role: UserRole) => boolean,
  permissionName: string
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user || !permissionFn(user.role)) {
      return next(
        new ApiError(403, `Permission denied: ${permissionName}`, "forbidden")
      );
    }
    return next();
  };
}

const DEFAULT_JWT_SECRET = "replace-with-a-long-random-production-secret";

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required. Set it to a long random string.");
  }

  if (secret === DEFAULT_JWT_SECRET || secret.length < 16) {
    throw new Error("JWT_SECRET must be a strong secret (min 16 characters). Do not use the default placeholder value.");
  }

  return secret;
}
