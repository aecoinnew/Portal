import bcrypt from "bcrypt";
import { Router } from "express";
import jwt, { type SignOptions } from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import type { AuthUser } from "../../lib/types/domain.js";
import { db } from "../db/connection.js";
import { authenticate, jwtSecret, type AuthedRequest } from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: "Too many login attempts. Please try again later.", code: "rate_limited" } }
});

type UserAuthRow = AuthUser & {
  password_hash: string;
  must_change_password: number;
};

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const row = db
      .prepare("SELECT id, name, email, password_hash, role, status, must_change_password FROM users WHERE email = ?")
      .get(body.email) as UserAuthRow | undefined;

    if (!row) {
      throw new ApiError(401, "Incorrect email or password", "invalid_credentials");
    }

    const validPassword = await bcrypt.compare(body.password, row.password_hash);
    if (!validPassword) {
      throw new ApiError(401, "Incorrect email or password", "invalid_credentials");
    }

    if (row.status === "suspended") {
      throw new ApiError(403, "Account is suspended", "account_suspended");
    }

    const user: AuthUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status
    };

    const signOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as SignOptions["expiresIn"]
    };
    const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret(), signOptions);

    res.json({ token, user, mustChangePassword: row.must_change_password === 1 });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", authenticate, (req, res) => {
  res.json({ user: (req as AuthedRequest).user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(128)
});

authRouter.post("/change-password", authenticate, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const user = (req as AuthedRequest).user;
    const row = db
      .prepare("SELECT password_hash FROM users WHERE id = ?")
      .get(user.id) as { password_hash: string } | undefined;
    if (!row) throw new ApiError(404, "User not found", "user_not_found");

    const ok = await bcrypt.compare(body.currentPassword, row.password_hash);
    if (!ok) throw new ApiError(401, "Current password is incorrect", "invalid_credentials");

    if (body.currentPassword === body.newPassword) {
      throw new ApiError(400, "New password must differ from current", "weak_password");
    }

    const newHash = await bcrypt.hash(body.newPassword, 12);
    db.prepare(
      "UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?"
    ).run(newHash, user.id);

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
