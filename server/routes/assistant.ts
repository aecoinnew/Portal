import { Router } from "express";
import { z } from "zod";
import { db, nowIso, uid } from "../db/connection.js";
import {
  authenticate,
  requireSuperAdmin,
  type AuthedRequest
} from "../middleware/auth.js";
import { ApiError } from "../middleware/error.js";
import { auditLog } from "../services/auditService.js";
import {
  getAssistantConfig,
  updateAssistantConfig,
  askAssistant,
  countUserMessagesToday,
  AssistantDisabledError,
  AssistantNotConfiguredError
} from "../services/assistantService.js";

export const assistantRouter = Router();

assistantRouter.use(authenticate);

// ---------------------------------------------------------------------------
// Config schema (super_admin only). Note: the DeepSeek API key is NEVER
// accepted or returned here; it lives only in the server environment.
// ---------------------------------------------------------------------------
const configSchema = z.object({
  enabled: z.boolean().optional(),
  model: z.string().min(1).max(80).optional(),
  baseUrl: z.string().url().max(300).optional(),
  systemPrompt: z.string().max(8000).optional(),
  maxTokens: z.number().int().min(64).max(4000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  dailyMessageLimit: z.number().int().min(0).max(10000).optional()
});

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000)
      })
    )
    .max(20)
    .optional()
});

function requestId(req: { requestId?: string }) {
  return req.requestId ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/assistant/config  (super_admin) - returns config + whether a key is set
// ---------------------------------------------------------------------------
assistantRouter.get("/config", requireSuperAdmin, (_req, res) => {
  const cfg = getAssistantConfig();
  res.json({
    config: cfg,
    apiKeyConfigured: Boolean(process.env.ASSISTANT_API_KEY || process.env.DEEPSEEK_API_KEY)
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/assistant/config  (super_admin)
// ---------------------------------------------------------------------------
assistantRouter.patch("/config", requireSuperAdmin, (req, res, next) => {
  try {
    const body = configSchema.parse(req.body);
    const me = (req as unknown as AuthedRequest).user;
    const updated = updateAssistantConfig(body, me.id);
    auditLog(me, "assistant.config.updated", "assistant", "global", {
      fields: Object.keys(body),
      enabled: updated.enabled,
      model: updated.model,
      requestId: requestId(req as unknown as { requestId?: string })
    });
    res.json({ config: updated, apiKeyConfigured: Boolean(process.env.ASSISTANT_API_KEY || process.env.DEEPSEEK_API_KEY) });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/assistant/status  (any authenticated user) - is the assistant on?
// ---------------------------------------------------------------------------
assistantRouter.get("/status", (_req, res) => {
  const cfg = getAssistantConfig();
  res.json({ enabled: cfg.enabled });
});

// ---------------------------------------------------------------------------
// POST /api/assistant/chat  (any authenticated user)
// Explainer-only assistant. Rate-limited per user per day.
// ---------------------------------------------------------------------------
assistantRouter.post("/chat", async (req, res, next) => {
  try {
    const body = chatSchema.parse(req.body);
    const me = (req as unknown as AuthedRequest).user;
    const cfg = getAssistantConfig();

    if (!cfg.enabled) {
      throw new ApiError(403, "The assistant is currently unavailable.", "assistant_disabled");
    }

    if (cfg.dailyMessageLimit > 0) {
      const used = countUserMessagesToday(me.id);
      if (used >= cfg.dailyMessageLimit) {
        throw new ApiError(
          429,
          "You have reached today's message limit for the assistant.",
          "assistant_rate_limited"
        );
      }
    }

    const result = await askAssistant({
      message: body.message,
      history: body.history ?? [],
      userId: me.id,
      userRole: me.role
    });

    res.json({ reply: result.reply });
  } catch (error) {
    if (error instanceof AssistantDisabledError) {
      return next(new ApiError(403, "The assistant is currently unavailable.", "assistant_disabled"));
    }
    if (error instanceof AssistantNotConfiguredError) {
      return next(
        new ApiError(503, "The assistant is not fully configured yet.", "assistant_not_configured")
      );
    }
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/assistant/logs  (super_admin) - recent Q/A for review
// ---------------------------------------------------------------------------
assistantRouter.get("/logs", requireSuperAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows = db
    .prepare(
      `SELECT l.id, l.user_id, l.user_role, l.question, l.answer, l.model,
              l.status, l.error, l.created_at, u.name AS user_name, u.email AS user_email
       FROM assistant_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<Record<string, unknown>>;

  res.json({
    logs: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name ?? null,
      userEmail: r.user_email ?? null,
      userRole: r.user_role,
      question: r.question,
      answer: r.answer,
      model: r.model,
      status: r.status,
      error: r.error,
      createdAt: r.created_at
    }))
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/assistant/logs  (super_admin) - clear conversation logs
// ---------------------------------------------------------------------------
assistantRouter.delete("/logs", requireSuperAdmin, (req, res) => {
  const me = (req as unknown as AuthedRequest).user;
  const result = db.prepare("DELETE FROM assistant_logs").run();
  auditLog(me, "assistant.logs.cleared", "assistant", "global", {
    deleted: result.changes,
    requestId: requestId(req as unknown as { requestId?: string })
  });
  res.json({ ok: true, deleted: result.changes });
});
