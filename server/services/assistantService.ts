import type { UserRole } from "../../lib/types/domain.js";
import { db, nowIso, uid } from "../db/connection.js";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class AssistantDisabledError extends Error {}
export class AssistantNotConfiguredError extends Error {}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type AssistantConfig = {
  enabled: boolean;
  model: string;
  baseUrl: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  dailyMessageLimit: number;
  updatedAt: string;
  updatedBy: string | null;
};

type ConfigRow = {
  enabled: number;
  model: string;
  base_url: string;
  system_prompt: string;
  max_tokens: number;
  temperature: number;
  daily_message_limit: number;
  updated_at: string;
  updated_by: string | null;
};

type ChatTurn = { role: "user" | "assistant"; content: string };

// ---------------------------------------------------------------------------
// Config read / write
// ---------------------------------------------------------------------------
export function getAssistantConfig(): AssistantConfig {
  const row = db
    .prepare(
      `SELECT enabled, model, base_url, system_prompt, max_tokens, temperature,
              daily_message_limit, updated_at, updated_by
       FROM assistant_config WHERE id = 'global'`
    )
    .get() as ConfigRow | undefined;

  if (!row) {
    // Should not happen (seeded in init.ts), but stay safe.
    return {
      enabled: false,
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1",
      systemPrompt: "",
      maxTokens: 600,
      temperature: 0.3,
      dailyMessageLimit: 50,
      updatedAt: nowIso(),
      updatedBy: null
    };
  }

  return {
    enabled: Boolean(row.enabled),
    model: row.model,
    baseUrl: row.base_url,
    systemPrompt: row.system_prompt,
    maxTokens: row.max_tokens,
    temperature: row.temperature,
    dailyMessageLimit: row.daily_message_limit,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  };
}

type ConfigPatch = Partial<{
  enabled: boolean;
  model: string;
  baseUrl: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
  dailyMessageLimit: number;
}>;

export function updateAssistantConfig(patch: ConfigPatch, updatedBy: string): AssistantConfig {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (patch.enabled !== undefined) {
    updates.push("enabled = ?");
    values.push(patch.enabled ? 1 : 0);
  }
  if (patch.model !== undefined) {
    updates.push("model = ?");
    values.push(patch.model);
  }
  if (patch.baseUrl !== undefined) {
    updates.push("base_url = ?");
    values.push(patch.baseUrl);
  }
  if (patch.systemPrompt !== undefined) {
    updates.push("system_prompt = ?");
    values.push(patch.systemPrompt);
  }
  if (patch.maxTokens !== undefined) {
    updates.push("max_tokens = ?");
    values.push(patch.maxTokens);
  }
  if (patch.temperature !== undefined) {
    updates.push("temperature = ?");
    values.push(patch.temperature);
  }
  if (patch.dailyMessageLimit !== undefined) {
    updates.push("daily_message_limit = ?");
    values.push(patch.dailyMessageLimit);
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    values.push(nowIso());
    updates.push("updated_by = ?");
    values.push(updatedBy);
    db.prepare(`UPDATE assistant_config SET ${updates.join(", ")} WHERE id = 'global'`).run(...values);
  }

  return getAssistantConfig();
}

// ---------------------------------------------------------------------------
// Per-user daily rate limiting
// ---------------------------------------------------------------------------
export function countUserMessagesToday(userId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM assistant_logs
       WHERE user_id = ? AND date(created_at) = date('now') AND status = 'ok'`
    )
    .get(userId) as { n: number };
  return row.n;
}

// ---------------------------------------------------------------------------
// Core: ask the assistant.
// ---------------------------------------------------------------------------
type AskParams = {
  message: string;
  history: ChatTurn[];
  userId: string;
  userRole: UserRole;
};

export async function askAssistant(params: AskParams): Promise<{ reply: string }> {
  const cfg = getAssistantConfig();
  if (!cfg.enabled) {
    throw new AssistantDisabledError("assistant disabled");
  }

  const apiKey = process.env.ASSISTANT_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    logInteraction({
      userId: params.userId,
      userRole: params.userRole,
      question: params.message,
      answer: null,
      model: cfg.model,
      status: "error",
      error: "missing_api_key"
    });
    throw new AssistantNotConfiguredError("missing api key");
  }

  // Build message list. The system prompt enforces explainer-only scope.
  const messages = [
    { role: "system" as const, content: cfg.systemPrompt },
    ...params.history.slice(-12).map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: params.message }
  ];

  let reply = "";
  let tokensPrompt: number | null = null;
  let tokensCompletion: number | null = null;

  try {
    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        stream: false
      }),
      signal: AbortSignal.timeout(60000)
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      throw new Error(`upstream ${resp.status}: ${detail.slice(0, 300)}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    reply = data?.choices?.[0]?.message?.content?.trim() ?? "";
    tokensPrompt = data?.usage?.prompt_tokens ?? null;
    tokensCompletion = data?.usage?.completion_tokens ?? null;

    if (!reply) {
      throw new Error("empty completion");
    }
  } catch (err) {
    logInteraction({
      userId: params.userId,
      userRole: params.userRole,
      question: params.message,
      answer: null,
      model: cfg.model,
      status: "error",
      error: err instanceof Error ? err.message.slice(0, 500) : "unknown_error"
    });
    throw new Error("assistant_upstream_failed");
  }

  logInteraction({
    userId: params.userId,
    userRole: params.userRole,
    question: params.message,
    answer: reply,
    model: cfg.model,
    status: "ok",
    tokensPrompt,
    tokensCompletion
  });

  return { reply };
}

// ---------------------------------------------------------------------------
// Streaming variant: invokes onDelta for each token chunk and resolves with
// the full reply once complete. Logs the interaction at the end (ok or error).
// ---------------------------------------------------------------------------
type AskStreamParams = AskParams & {
  onDelta: (chunk: string) => void;
  signal?: AbortSignal;
};

export async function askAssistantStream(params: AskStreamParams): Promise<{ reply: string }> {
  const cfg = getAssistantConfig();
  if (!cfg.enabled) {
    throw new AssistantDisabledError("assistant disabled");
  }

  const apiKey = process.env.ASSISTANT_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    logInteraction({
      userId: params.userId,
      userRole: params.userRole,
      question: params.message,
      answer: null,
      model: cfg.model,
      status: "error",
      error: "missing_api_key"
    });
    throw new AssistantNotConfiguredError("missing api key");
  }

  const messages = [
    { role: "system" as const, content: cfg.systemPrompt },
    ...params.history.slice(-12).map((t) => ({ role: t.role, content: t.content })),
    { role: "user" as const, content: params.message }
  ];

  let reply = "";

  try {
    const resp = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        stream: true
      }),
      signal: params.signal ?? AbortSignal.timeout(60000)
    });

    if (!resp.ok || !resp.body) {
      const detail = resp.ok ? "no body" : await resp.text().catch(() => "");
      throw new Error(`upstream ${resp.status}: ${String(detail).slice(0, 300)}`);
    }

    // Parse the OpenAI-compatible SSE stream: lines like `data: {json}` and `data: [DONE]`.
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) {
            reply += delta;
            params.onDelta(delta);
          }
        } catch {
          // ignore keep-alive / partial lines
        }
      }
    }

    if (!reply.trim()) {
      throw new Error("empty completion");
    }
  } catch (err) {
    logInteraction({
      userId: params.userId,
      userRole: params.userRole,
      question: params.message,
      answer: null,
      model: cfg.model,
      status: "error",
      error: err instanceof Error ? err.message.slice(0, 500) : "unknown_error"
    });
    throw new Error("assistant_upstream_failed");
  }

  logInteraction({
    userId: params.userId,
    userRole: params.userRole,
    question: params.message,
    answer: reply.trim(),
    model: cfg.model,
    status: "ok"
  });

  return { reply: reply.trim() };
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
type LogParams = {
  userId: string;
  userRole: UserRole;
  question: string;
  answer: string | null;
  model: string;
  status: "ok" | "error";
  error?: string;
  tokensPrompt?: number | null;
  tokensCompletion?: number | null;
};

function logInteraction(p: LogParams) {
  try {
    db.prepare(
      `INSERT INTO assistant_logs
        (id, user_id, user_role, question, answer, model, tokens_prompt, tokens_completion, status, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uid("asl"),
      p.userId,
      p.userRole,
      p.question,
      p.answer,
      p.model,
      p.tokensPrompt ?? null,
      p.tokensCompletion ?? null,
      p.status,
      p.error ?? null,
      nowIso()
    );
  } catch {
    // Never let logging failure break the request.
  }
}
