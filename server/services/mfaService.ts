import crypto from "node:crypto";
import { authenticator } from "otplib";
import { db } from "../db/connection.js";

/**
 * MFA service: TOTP secrets encrypted at rest using AES-256-GCM.
 *
 * Encryption key is derived from JWT_SECRET (already a strong server secret).
 * If JWT_SECRET rotates, existing MFA secrets are unrecoverable - super_admin
 * would need to disable MFA for affected users via /admin/master.
 */

authenticator.options = {
  step: 30,        // 30-second window (standard)
  window: 1,       // accept codes from previous and next window (clock drift tolerance)
  digits: 6
};

const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set and >= 16 chars for MFA encryption.");
  }
  return crypto.createHash("sha256").update("emcoin-mfa-v1::" + secret).digest();
}

/** Encrypts a TOTP secret. Returns base64 of (iv || tag || ciphertext). */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, deriveKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

/** Decrypts a stored MFA secret. */
export function decryptSecret(blob: string): string {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, deriveKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/** Generate a fresh TOTP secret in base32 (RFC 4648). */
export function generateSecret(): string {
  return authenticator.generateSecret();
}

/** Build the otpauth:// URL used by authenticator apps. */
export function buildOtpAuthUrl(secret: string, accountName: string): string {
  const issuer = process.env.NEXT_PUBLIC_BRAND_NAME ?? "EisaX Wealth";
  return authenticator.keyuri(accountName, issuer, secret);
}

/** Verify a TOTP code against a secret. Constant-time. */
export function verifyTotp(secret: string, code: string): boolean {
  try {
    return authenticator.check(code.replace(/\s+/g, ""), secret);
  } catch {
    return false;
  }
}

/** Roles that REQUIRE MFA enrollment (privileged accounts). */
const PRIVILEGED_ROLES = new Set(["super_admin", "admin", "operations", "compliance", "finance"]);
export function isPrivilegedRole(role: string): boolean {
  return PRIVILEGED_ROLES.has(role);
}

/** Get a user's MFA state without exposing the secret. */
export function getUserMfaState(userId: string): { mfaEnabled: boolean; hasSecret: boolean } {
  const row = db
    .prepare("SELECT mfa_enabled, mfa_secret FROM users WHERE id = ?")
    .get(userId) as { mfa_enabled: number; mfa_secret: string | null } | undefined;
  if (!row) return { mfaEnabled: false, hasSecret: false };
  return { mfaEnabled: row.mfa_enabled === 1, hasSecret: row.mfa_secret !== null };
}
