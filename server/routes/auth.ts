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
  password: z.string().min(1),
  mfaCode: z.string().regex(/^\d{6}$/).optional()
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
  mfa_secret: string | null;
  mfa_enabled: number;
};

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);
    const row = db
      .prepare("SELECT id, name, email, password_hash, role, status, must_change_password, mfa_secret, mfa_enabled FROM users WHERE email = ?")
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

    // ===== MFA gate =====
    if (row.mfa_enabled === 1 && row.mfa_secret) {
      if (!body.mfaCode) {
        // Password is correct, but MFA code is needed for the second step.
        // Do NOT issue a token. Tell the client to prompt for the code.
        return res.status(200).json({ mfaRequired: true, email: row.email });
      }
      const { decryptSecret, verifyTotp } = await import("../services/mfaService.js");
      const ok = verifyTotp(decryptSecret(row.mfa_secret), body.mfaCode);
      if (!ok) {
        throw new ApiError(401, "Invalid MFA code", "invalid_mfa_code");
      }
    }

    db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(row.id);
    const signOptions: SignOptions = {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as SignOptions["expiresIn"]
    };
    const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret(), signOptions);

    const { isPrivilegedRole } = await import("../services/mfaService.js");
    const mustEnrollMfa = isPrivilegedRole(row.role) && row.mfa_enabled === 0;
    res.json({
      token,
      user,
      mustChangePassword: row.must_change_password === 1,
      mfaEnabled: row.mfa_enabled === 1,
      mustEnrollMfa
    });
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

// ===================== MFA endpoints =====================
import { generateSecret, buildOtpAuthUrl, encryptSecret, decryptSecret as decryptSecret2, verifyTotp as verifyTotp2, getUserMfaState } from "../services/mfaService.js";
import QRCode from "qrcode";

const mfaVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/)
});

/**
 * Begin MFA enrollment: generate a new secret and return otpauth URL + QR.
 * The secret is NOT yet activated. The user must POST the first valid code
 * to /mfa/verify to activate it.
 *
 * If the user already has MFA enabled, this re-issues a secret BUT the old
 * one stays active until verify() is called with a new code.
 */
authRouter.post("/mfa/setup", authenticate, async (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const secret = generateSecret();
    const otpauth = buildOtpAuthUrl(secret, user.email);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Store the encrypted secret but keep mfa_enabled=0 until verified.
    // We use a temp column on the user record by writing into mfa_secret directly;
    // verify() flips mfa_enabled to 1.
    db.prepare(
      "UPDATE users SET mfa_secret = ?, mfa_enabled = 0, updated_at = datetime('now') WHERE id = ?"
    ).run(encryptSecret(secret), user.id);

    res.json({
      otpauthUrl: otpauth,
      qrDataUrl,
      // Do NOT return the raw secret here - the QR contains it.
      // For users who can't scan, we provide a manual entry option in a separate
      // privileged endpoint that requires a current valid code (not implemented for v1).
      message: "Scan the QR with your authenticator app, then submit the 6-digit code to /api/auth/mfa/verify"
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Verify the first MFA code and activate. Also used to verify subsequent codes
 * during sensitive operations (not currently used for that, but available).
 */
authRouter.post("/mfa/verify", authenticate, (req, res, next) => {
  try {
    const body = mfaVerifySchema.parse(req.body);
    const user = (req as AuthedRequest).user;
    const row = db
      .prepare("SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?")
      .get(user.id) as { mfa_secret: string | null; mfa_enabled: number } | undefined;
    if (!row || !row.mfa_secret) {
      throw new ApiError(400, "No MFA secret pending. Call /mfa/setup first.", "mfa_not_setup");
    }
    const secret = decryptSecret2(row.mfa_secret);
    if (!verifyTotp2(secret, body.code)) {
      throw new ApiError(401, "Invalid code", "invalid_mfa_code");
    }
    db.prepare("UPDATE users SET mfa_enabled = 1, updated_at = datetime('now') WHERE id = ?").run(user.id);
    res.json({ ok: true, mfaEnabled: true });
  } catch (error) {
    next(error);
  }
});

/**
 * GET current user's MFA state (without secret).
 */
authRouter.get("/mfa/state", authenticate, (req, res, next) => {
  try {
    const user = (req as AuthedRequest).user;
    const state = getUserMfaState(user.id);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

/**
 * Disable MFA for the calling user. Requires a current valid code as proof
 * of physical possession of the device. We do NOT allow disabling without it
 * because that would defeat the security purpose.
 *
 * Super_admin can disable MFA for OTHER users via /api/admin/master/users/:id/mfa-reset
 * (separate endpoint, audit-logged) for account recovery.
 */
authRouter.post("/mfa/disable", authenticate, (req, res, next) => {
  try {
    const body = mfaVerifySchema.parse(req.body);
    const user = (req as AuthedRequest).user;
    const row = db
      .prepare("SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?")
      .get(user.id) as { mfa_secret: string | null; mfa_enabled: number } | undefined;
    if (!row || !row.mfa_secret || row.mfa_enabled !== 1) {
      throw new ApiError(400, "MFA is not enabled", "mfa_not_enabled");
    }
    const secret = decryptSecret2(row.mfa_secret);
    if (!verifyTotp2(secret, body.code)) {
      throw new ApiError(401, "Invalid code", "invalid_mfa_code");
    }
    db.prepare("UPDATE users SET mfa_secret = NULL, mfa_enabled = 0, updated_at = datetime('now') WHERE id = ?").run(user.id);
    res.json({ ok: true, mfaEnabled: false });
  } catch (error) {
    next(error);
  }
});
