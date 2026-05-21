import { Router } from "express";
import { z } from "zod";
import type { AppSettings, SupportedCurrency } from "../../lib/types/domain.js";
import { db, nowIso } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { auditLog } from "../services/auditService.js";

export const settingsRouter = Router();

const settingsSchema = z.object({
  baseCurrency: z.enum(["AED", "USD"]),
  allowUsd: z.boolean()
}).refine((settings) => settings.baseCurrency !== "USD" || settings.allowUsd, {
  message: "USD must be allowed when it is the base currency",
  path: ["allowUsd"]
});

settingsRouter.use(authenticate);

settingsRouter.get("/", (_req, res) => {
  res.json({ settings: getSettings() });
});

settingsRouter.patch("/", requireAdmin, (req, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    const admin = (req as unknown as AuthedRequest).user;
    const timestamp = nowIso();

    db.prepare(
      `
      UPDATE app_settings
      SET base_currency = ?, allow_usd = ?, updated_at = ?
      WHERE id = 'global'
      `
    ).run(body.baseCurrency, body.allowUsd ? 1 : 0, timestamp);

    auditLog(admin, "settings.updated", "app_settings", "global", body);
    res.json({ settings: getSettings() });
  } catch (error) {
    next(error);
  }
});

export function getSettings(): AppSettings {
  const row = db
    .prepare("SELECT base_currency, allow_usd, updated_at FROM app_settings WHERE id = 'global'")
    .get() as { base_currency: SupportedCurrency; allow_usd: 0 | 1; updated_at: string } | undefined;

  return {
    baseCurrency: row?.base_currency ?? "AED",
    allowUsd: Boolean(row?.allow_usd ?? 1),
    updatedAt: row?.updated_at ?? nowIso()
  };
}

export function isCurrencyAllowed(currency: SupportedCurrency) {
  const settings = getSettings();
  return currency === "AED" || settings.allowUsd;
}
