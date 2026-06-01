"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, MessageCircle, Info } from "lucide-react";
import { apiRequest, apiBaseUrl, getStoredToken } from "@/lib/api/client";
import { useI18n } from "@/contexts/i18n-context";

type Turn = { role: "user" | "assistant"; content: string };

const QUICK_REPLIES_EN = [
  "How do I view my statements?",
  "How do I submit a request?",
  "What does my portfolio page show?",
  "How do I change my password?"
];

const QUICK_REPLIES_AR = [
  "إزاي أشوف كشوف الحساب بتاعتي؟",
  "إزاي أقدّم طلب؟",
  "إيه اللي بتعرضه صفحة المحفظة؟",
  "إزاي أغيّر كلمة المرور؟"
];

export function FloatingAssistant() {
  const { t, locale } = useI18n();
  const QUICK_REPLIES = locale === "ar" ? QUICK_REPLIES_AR : QUICK_REPLIES_EN;
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  // Check availability once on mount so we can hide the bubble entirely when off.
  useEffect(() => {
    apiRequest<{ enabled: boolean }>("/assistant/status")
      .then((d) => setEnabled(d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, sending, open]);

  function mapErrorCode(code: string | null): string {
    if (code === "assistant_disabled") return "The assistant is currently unavailable.";
    if (code === "assistant_rate_limited")
      return "You've reached today's message limit. Please try again later.";
    if (code === "assistant_not_configured") return "The assistant is not fully configured yet.";
    return "Something went wrong. Please try again.";
  }

  async function sendMessage(message: string) {
    const text = message.trim();
    if (!text || sending) return;

    setError(null);
    const history = turns.slice(-12);
    setTurns((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    setStreaming(false);

    try {
      const resp = await fetch(`${apiBaseUrl()}/assistant/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getStoredToken() ?? ""}`
        },
        body: JSON.stringify({ message: text, history })
      });

      if (!resp.ok || !resp.body) {
        let code: string | null = null;
        try {
          const body = await resp.json();
          code = body?.error?.code ?? null;
        } catch {
          /* ignore */
        }
        setError(mapErrorCode(code));
        setSending(false);
        return;
      }

      // Append an empty assistant turn we'll fill as chunks arrive.
      setStreaming(true);
      setTurns((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let gotError: string | null = null;

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
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload) as { delta?: string; done?: boolean; error?: string };
            if (evt.error) {
              gotError = evt.error;
            } else if (evt.delta) {
              setTurns((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = { role: "assistant", content: last.content + evt.delta };
                }
                return next;
              });
            }
          } catch {
            /* ignore partial */
          }
        }
      }

      if (gotError) {
        // Replace the empty/partial assistant bubble with nothing, show error.
        setTurns((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant" && last.content === "") next.pop();
          return next;
        });
        setError(mapErrorCode(gotError));
      }
    } catch {
      setError("Connection lost. Please try again.");
    } finally {
      setSending(false);
      setStreaming(false);
    }
  }

  // Hide the entire widget when the assistant is disabled by the admin.
  if (enabled === false) return null;

  return (
    <>
      {/* Launcher bubble */}
      <button
        type="button"
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition hover:scale-105"
        style={{ background: "var(--accent-primary)", color: "#fff" }}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open ? (
        <div
          className="fixed bottom-24 right-5 z-50 flex w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            height: "min(560px, calc(100vh - 8rem))",
            background: "var(--bg-surface)",
            borderColor: "var(--border-subtle)"
          }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ background: "var(--accent-primary)", color: "#fff" }}
          >
            <Bot className="h-5 w-5" />
            <div className="flex-1">
              <div className="text-[14px] font-semibold leading-tight">{t("assistant.title")}</div>
              <div className="text-[11px] opacity-80">{t("assistant.subtitle")}</div>
            </div>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/15">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Disclaimer */}
          <div
            className="px-3 py-2 text-[11px]"
            style={{ background: "var(--bg-surface-2)", color: "var(--fg-3)" }}
          >
            <Info className="mr-1 inline h-3 w-3" />
            {t("assistant.disclaimer")}
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {turns.length === 0 ? (
              <div className="mt-4">
                <div className="text-center text-[13px]" style={{ color: "var(--fg-3)" }}>
                  {t("assistant.greeting")}
                </div>
                <div className="mt-4 space-y-2">
                  {QUICK_REPLIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendMessage(q)}
                      disabled={enabled === null || sending}
                      className="block w-full rounded-lg border px-3 py-2 text-left text-[12px] transition hover:opacity-80 disabled:opacity-50"
                      style={{ borderColor: "var(--border-subtle)", color: "var(--fg-2)", background: "var(--bg-surface-2)" }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map((t, i) => (
                <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className="max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px]"
                    style={
                      t.role === "user"
                        ? { background: "var(--accent-primary)", color: "#fff", borderBottomRightRadius: 4 }
                        : { background: "var(--bg-surface-3)", color: "var(--fg-1)", borderBottomLeftRadius: 4 }
                    }
                  >
                    {t.content || (streaming ? "…" : "")}
                  </div>
                </div>
              ))
            )}
            {sending && !streaming ? (
              <div className="flex justify-start">
                <div className="rounded-2xl px-3 py-2 text-[13px]" style={{ background: "var(--bg-surface-3)", color: "var(--fg-3)" }}>
                  Typing…
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          {error ? (
            <div className="px-4 pb-1 text-[12px] text-rose-500">{error}</div>
          ) : null}

          {/* Composer */}
          <div className="flex items-end gap-2 border-t p-3" style={{ borderColor: "var(--border-subtle)" }}>
            <textarea
              className="textarea max-h-28 min-h-[40px] flex-1 resize-none"
              rows={1}
              placeholder={t("assistant.placeholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              disabled={enabled === null || sending}
            />
            <button
              type="button"
              className="btn btn-primary h-10 shrink-0 px-3"
              onClick={() => void sendMessage(input)}
              disabled={enabled === null || sending || !input.trim()}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
