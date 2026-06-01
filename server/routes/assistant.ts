import { Router } from "express";
import rateLimit from "express-rate-limit";
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
  askAssistantStream,
  countUserMessagesToday,
  AssistantDisabledError,
  AssistantNotConfiguredError
} from "../services/assistantService.js";

export const assistantRouter = Router();

assistantRouter.use(authenticate);

// ---------------------------------------------------------------------------
// Dedicated burst limiter for chat: protects the paid LLM provider from abuse
// and runaway loops. This is a short-window throttle that complements the
// per-user *daily* cap enforced from assistant_config in the DB.
// Keyed by authenticated user id (falls back to IP).
// ---------------------------------------------------------------------------
const chatBurstLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const u = (req as unknown as AuthedRequest).user;
    return u?.id ?? req.ip ?? "anon";
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        message: "You're sending messages too quickly. Please wait a moment.",
        code: "assistant_rate_limited"
      }
    });
  }
});

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

// Strip control characters (except newline/tab) and collapse excessive whitespace.
function sanitizeText(input: string): string {
  return input
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]{3,}/g, "  ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

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
assistantRouter.post("/chat", chatBurstLimiter, async (req, res, next) => {
  try {
    const body = chatSchema.parse(req.body);
    const me = (req as unknown as AuthedRequest).user;
    const cfg = getAssistantConfig();

    if (!cfg.enabled) {
      throw new ApiError(403, "The assistant is currently unavailable.", "assistant_disabled");
    }

    const cleanMessage = sanitizeText(body.message);
    if (!cleanMessage) {
      throw new ApiError(400, "Message is empty.", "empty_message");
    }
    const cleanHistory = (body.history ?? [])
      .map((t) => ({ role: t.role, content: sanitizeText(t.content) }))
      .filter((t) => t.content.length > 0);

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
      message: cleanMessage,
      history: cleanHistory,
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
// POST /api/assistant/chat/stream  (any authenticated user)
// Server-Sent Events: streams the reply token-by-token.
// Event lines: `data: {"delta":"..."}` then a final `data: {"done":true}`.
// On error before/within stream: `data: {"error":"code"}`.
// ---------------------------------------------------------------------------
assistantRouter.post("/chat/stream", chatBurstLimiter, async (req, res) => {
  const me = (req as unknown as AuthedRequest).user;

  // Validate first; if invalid, respond as normal JSON error (headers not yet SSE).
  let cleanMessage = "";
  let cleanHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  try {
    const body = chatSchema.parse(req.body);
    const cfg = getAssistantConfig();
    if (!cfg.enabled) {
      return res.status(403).json({ error: { message: "The assistant is currently unavailable.", code: "assistant_disabled" } });
    }
    cleanMessage = sanitizeText(body.message);
    if (!cleanMessage) {
      return res.status(400).json({ error: { message: "Message is empty.", code: "empty_message" } });
    }
    cleanHistory = (body.history ?? [])
      .map((t) => ({ role: t.role, content: sanitizeText(t.content) }))
      .filter((t) => t.content.length > 0);

    if (cfg.dailyMessageLimit > 0 && countUserMessagesToday(me.id) >= cfg.dailyMessageLimit) {
      return res.status(429).json({ error: { message: "You have reached today's message limit for the assistant.", code: "assistant_rate_limited" } });
    }
  } catch (err) {
    return res.status(400).json({ error: { message: "Invalid request.", code: "invalid_request" } });
  }

  // Open the SSE stream.
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx proxy buffering
  res.flushHeaders?.();

  const ac = new AbortController();
  req.on("close", () => ac.abort());

  try {
    await askAssistantStream({
      message: cleanMessage,
      history: cleanHistory,
      userId: me.id,
      userRole: me.role,
      signal: ac.signal,
      onDelta: (chunk) => {
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`);
      }
    });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    let code = "assistant_error";
    if (err instanceof AssistantDisabledError) code = "assistant_disabled";
    else if (err instanceof AssistantNotConfiguredError) code = "assistant_not_configured";
    res.write(`data: ${JSON.stringify({ error: code })}\n\n`);
  } finally {
    res.end();
  }
});

// ---------------------------------------------------------------------------
// GET /api/assistant/stats  (super_admin) - usage analytics
// ---------------------------------------------------------------------------
assistantRouter.get("/stats", requireSuperAdmin, (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok,
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
         COUNT(DISTINCT user_id) AS users,
         COALESCE(SUM(COALESCE(tokens_prompt,0) + COALESCE(tokens_completion,0)), 0) AS tokens
       FROM assistant_logs`
    )
    .get() as { total: number; ok: number; errors: number; users: number; tokens: number };

  const today = db
    .prepare(
      `SELECT COUNT(*) AS n FROM assistant_logs WHERE date(created_at) = date('now')`
    )
    .get() as { n: number };

  const last7 = db
    .prepare(
      `SELECT date(created_at) AS day, COUNT(*) AS n
       FROM assistant_logs
       WHERE created_at >= datetime('now', '-7 days')
       GROUP BY date(created_at)
       ORDER BY day DESC`
    )
    .all() as Array<{ day: string; n: number }>;

  const topUsers = db
    .prepare(
      `SELECT l.user_id, u.name AS user_name, u.email AS user_email, COUNT(*) AS n
       FROM assistant_logs l
       LEFT JOIN users u ON u.id = l.user_id
       WHERE l.created_at >= datetime('now', '-30 days')
       GROUP BY l.user_id
       ORDER BY n DESC
       LIMIT 5`
    )
    .all() as Array<{ user_id: string; user_name: string | null; user_email: string | null; n: number }>;

  res.json({
    totals: {
      total: totals.total ?? 0,
      ok: totals.ok ?? 0,
      errors: totals.errors ?? 0,
      uniqueUsers: totals.users ?? 0,
      totalTokens: totals.tokens ?? 0,
      today: today.n ?? 0
    },
    last7Days: last7.map((r) => ({ day: r.day, count: r.n })),
    topUsers: topUsers.map((r) => ({
      userId: r.user_id,
      name: r.user_name ?? null,
      email: r.user_email ?? null,
      count: r.n
    }))
  });
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
