import { Router } from "express";
import { z } from "zod";
import type { AppSettings, SupportedCurrency } from "../../lib/types/domain.js";
import { db, nowIso } from "../db/connection.js";
import { authenticate, requireAdmin, type AuthedRequest } from "../middleware/auth.js";
import { auditLog } from "../services/auditService.js";
import { submitForApproval } from "../services/approvalExecutor.js";

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

// Phase 3: enforced maker-checker. PATCH creates pending approval, does not mutate.
settingsRouter.patch("/", requireAdmin, (req, res, next) => {
  try {
    const body = settingsSchema.parse(req.body);
    const admin = (req as unknown as AuthedRequest).user;
    const oldSettings = getSettings();

    const approval = submitForApproval({
      entityType: "app_settings",
      entityId: "global",
      action: "settings.updated",
      requestedBy: admin,
      beforePayload: oldSettings,
      afterPayload: body,
      reason: `Settings change: baseCurrency=${body.baseCurrency}, allowUsd=${body.allowUsd}`
    });

    auditLog(admin, "settings.update.submitted", "app_settings", "global", {
      approvalId: approval.id,
      proposed: body
    });

    res.status(202).json({
      pending: true,
      approvalId: approval.id,
      message: "Settings update submitted for approval."
    });
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
