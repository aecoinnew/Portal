import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../db/connection.js";
import { ApiError } from "./error.js";
import type { AuthUser, UserRole } from "../../lib/types/domain.js";

const jwtPayloadSchema = z.object({
  sub: z.string(),
  role: z.enum(["client", "admin"])
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "active" | "suspended";
};

export type AuthedRequest = Request & {
  user: AuthUser;
};

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return next(new ApiError(401, "Authentication required", "unauthenticated"));
  }

  try {
    const decoded = jwtPayloadSchema.parse(jwt.verify(token, jwtSecret()));
    const row = db
      .prepare("SELECT id, name, email, role, status FROM users WHERE id = ?")
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

    return next();
  } catch {
    return next(new ApiError(401, "Invalid or expired token", "invalid_token"));
  }
}

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    if (!user || user.role !== role) {
      return next(new ApiError(403, "Insufficient permissions", "forbidden"));
    }
    return next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole("admin")(req, res, next);
}

export function requireSelfOrAdmin(paramName = "userId") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as AuthedRequest).user;
    const targetUserId = req.params[paramName] ?? req.query[paramName];
    if (user.role !== "admin" && user.id !== targetUserId) {
      return next(new ApiError(403, "Cannot access another client account", "ownership_required"));
    }
    return next();
  };
}

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "replace-with-a-long-random-production-secret") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set to a strong production secret");
    }
    return "local-development-only-change-me";
  }
  return secret;
}
