"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Bot, Save, Trash2, RefreshCw, Send } from "lucide-react";
import { apiRequest } from "@/lib/api/client";

type AssistantConfig = {
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

type AssistantLog = {
  id: string;
  userName: string | null;
  userEmail: string | null;
  userRole: string;
  question: string;
  answer: string | null;
  model: string;
  status: string;
  error: string | null;
  createdAt: string;
};

type AssistantStats = {
  totals: {
    total: number;
    ok: number;
    errors: number;
    uniqueUsers: number;
    totalTokens: number;
    today: number;
  };
  last7Days: Array<{ day: string; count: number }>;
  topUsers: Array<{ userId: string; name: string | null; email: string | null; count: number }>;
};

export function AssistantPanel() {
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [logs, setLogs] = useState<AssistantLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [stats, setStats] = useState<AssistantStats | null>(null);

  // test widget
  const [testInput, setTestInput] = useState("");
  const [testReply, setTestReply] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function load() {
    const data = await apiRequest<{ config: AssistantConfig; apiKeyConfigured: boolean }>(
      "/assistant/config"
    );
    setConfig(data.config);
    setApiKeyConfigured(data.apiKeyConfigured);
    try {
      const s = await apiRequest<AssistantStats>("/assistant/stats");
      setStats(s);
    } catch {
      /* stats are best-effort */
    }
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load assistant config"))
      .finally(() => setLoading(false));
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest<{ config: AssistantConfig; apiKeyConfigured: boolean }>(
        "/assistant/config",
        {
          method: "PATCH",
          body: JSON.stringify({
            enabled: config.enabled,
            model: config.model,
            baseUrl: config.baseUrl,
            systemPrompt: config.systemPrompt,
            maxTokens: config.maxTokens,
            temperature: config.temperature,
            dailyMessageLimit: config.dailyMessageLimit
          })
        }
      );
      setConfig(data.config);
      setApiKeyConfigured(data.apiKeyConfigured);
      setNotice("Settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function loadLogs() {
    setError(null);
    try {
      const data = await apiRequest<{ logs: AssistantLog[] }>("/assistant/logs?limit=50");
      setLogs(data.logs);
      setShowLogs(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
    }
  }

  async function clearLogs() {
    if (!confirm("Clear all assistant conversation logs? This cannot be undone.")) return;
    try {
      await apiRequest<{ ok: boolean; deleted: number }>("/assistant/logs", { method: "DELETE" });
      setLogs([]);
      setNotice("Logs cleared.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear logs");
    }
  }

  async function runTest() {
    if (!testInput.trim()) return;
    setTesting(true);
    setTestReply(null);
    setError(null);
    try {
      const data = await apiRequest<{ reply: string }>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ message: testInput })
      });
      setTestReply(data.reply);
    } catch (e) {
      setTestReply(null);
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <section className="card">
        <div className="card-header">
          <div className="card-title">Customer Assistant</div>
        </div>
        <div className="p-5 text-[13px] text-slate-500">Loading…</div>
      </section>
    );
  }

  if (!config) return null;

  return (
    <section className="card">
      <div className="card-header flex items-center gap-2">
        <Bot className="h-4 w-4 text-navy-700" />
        <div className="card-title">Customer Assistant</div>
        <span
          className={
            config.enabled
              ? "tag bg-green-100 text-green-800 ml-2"
              : "tag bg-slate-200 text-slate-700 ml-2"
          }
        >
          {config.enabled ? "enabled" : "disabled"}
        </span>
      </div>

      <div className="p-5 space-y-5">
        <p className="text-[13px] text-slate-500">
          An explainer-only support assistant. It answers general platform and terminology
          questions. It never gives investment advice, recommendations, or predictions.
        </p>

        {stats ? (
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Total messages", value: stats.totals.total },
                { label: "Today", value: stats.totals.today },
                { label: "Unique users", value: stats.totals.uniqueUsers },
                { label: "Errors", value: stats.totals.errors }
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border p-3"
                  style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface-2)" }}
                >
                  <div className="text-[20px] font-semibold" style={{ color: "var(--fg-1)" }}>
                    {m.value.toLocaleString()}
                  </div>
                  <div className="text-[11px] muted">{m.label}</div>
                </div>
              ))}
            </div>
            {stats.totals.totalTokens > 0 ? (
              <div className="mt-2 text-[11px] muted">
                ~{stats.totals.totalTokens.toLocaleString()} tokens used (logged)
              </div>
            ) : null}
            {stats.topUsers.length > 0 ? (
              <div className="mt-3">
                <div className="label">Top users (30 days)</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {stats.topUsers.map((u) => (
                    <span
                      key={u.userId}
                      className="tag"
                      style={{ background: "var(--bg-surface-3)", color: "var(--fg-2)" }}
                    >
                      {u.name ?? u.email ?? "unknown"}: {u.count}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!apiKeyConfigured ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-[12px] text-amber-900">
            No assistant API key is set on the server. The assistant cannot send messages until
            ASSISTANT_API_KEY is configured in the API environment.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-[12px] text-rose-800">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-[12px] text-green-800">
            {notice}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={save}>
          <label className="flex items-center gap-2 text-[13px] font-medium text-slate-800">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            />
            Enable assistant for users
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Model</label>
              <input
                className="input"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
              />
              <p className="mt-1 text-[11px] text-slate-400">
                e.g. llama-3.3-70b-versatile (Groq) or deepseek-chat
              </p>
            </div>
            <div>
              <label className="label">Base URL</label>
              <input
                className="input"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Max tokens</label>
              <input
                className="input"
                type="number"
                min={64}
                max={4000}
                value={config.maxTokens}
                onChange={(e) => setConfig({ ...config, maxTokens: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Temperature</label>
              <input
                className="input"
                type="number"
                step={0.1}
                min={0}
                max={2}
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Daily message limit / user (0 = unlimited)</label>
              <input
                className="input"
                type="number"
                min={0}
                max={10000}
                value={config.dailyMessageLimit}
                onChange={(e) =>
                  setConfig({ ...config, dailyMessageLimit: Number(e.target.value) })
                }
              />
            </div>
          </div>

          <div>
            <label className="label">System prompt (defines scope and guardrails)</label>
            <textarea
              className="input min-h-[180px] font-mono text-[12px]"
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save settings"}
            </button>
            <button className="btn" type="button" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Reload
            </button>
            <span className="text-[11px] text-slate-400">
              Last updated {new Date(config.updatedAt).toLocaleString()}
            </span>
          </div>
        </form>

        {/* Test widget */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="mb-2 text-[13px] font-medium text-slate-800">Test the assistant</div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Ask a sample support question…"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void runTest();
                }
              }}
            />
            <button className="btn btn-primary" type="button" onClick={() => void runTest()} disabled={testing}>
              <Send className="h-4 w-4" /> {testing ? "…" : "Send"}
            </button>
          </div>
          {testReply ? (
            <div className="mt-3 whitespace-pre-wrap rounded border border-slate-200 bg-white p-3 text-[13px] text-slate-700">
              {testReply}
            </div>
          ) : null}
        </div>

        {/* Logs */}
        <div>
          <div className="flex items-center gap-3">
            <button className="btn" type="button" onClick={() => void loadLogs()}>
              View recent conversations
            </button>
            {showLogs ? (
              <button
                className="text-[12px] font-medium text-rose-700 hover:underline"
                type="button"
                onClick={() => void clearLogs()}
              >
                <Trash2 className="inline h-3.5 w-3.5 mr-1" />
                Clear logs
              </button>
            ) : null}
          </div>

          {showLogs ? (
            <div className="mt-3 table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>User</th>
                    <th>Question</th>
                    <th>Answer</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-[12px] text-slate-400">
                        No conversations logged yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((l) => (
                      <tr key={l.id}>
                        <td className="text-[11px]">{new Date(l.createdAt).toLocaleString()}</td>
                        <td className="text-[11px]">
                          {l.userName ?? l.userEmail ?? "—"}
                          <div className="text-slate-400">{l.userRole}</div>
                        </td>
                        <td className="max-w-[220px] truncate text-[12px]" title={l.question}>
                          {l.question}
                        </td>
                        <td className="max-w-[260px] truncate text-[12px]" title={l.answer ?? ""}>
                          {l.answer ?? "—"}
                        </td>
                        <td className="text-[11px]">
                          {l.status === "ok" ? (
                            <span className="tag bg-green-100 text-green-800">ok</span>
                          ) : (
                            <span className="tag bg-rose-100 text-rose-800" title={l.error ?? ""}>
                              error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
