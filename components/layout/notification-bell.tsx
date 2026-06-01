"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { useI18n } from "@/contexts/i18n-context";

type NotifItem = { key: string; label: string; count: number; href: string };

const LABEL_KEYS: Record<string, string> = {
  approvals: "notif.approvals",
  password_resets: "notif.resets"
};

export function NotificationBell() {
  const { t } = useI18n();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  async function load() {
    try {
      const data = await apiRequest<{ total: number; items: NotifItem[] }>("/notifications/summary");
      setItems(data.items);
      setTotal(data.total);
    } catch {
      /* notifications are best-effort; ignore failures */
    }
  }

  useEffect(() => {
    void load();
    // Poll every 60s so badges stay reasonably fresh without being chatty.
    const interval = setInterval(() => void load(), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Don't render the bell for users with nothing to act on (e.g. clients).
  if (items.length === 0 && total === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-slate-500 transition hover:bg-slate-100"
      >
        <Bell className="h-4 w-4" />
        {total > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
            style={{ background: "var(--loss)" }}
          >
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute end-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border shadow-2xl"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <div
            className="px-4 py-2.5 text-[12px] font-semibold"
            style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--fg-1)" }}
          >
            {t("notif.title")}
          </div>
          {total === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] muted">{t("notif.empty")}</div>
          ) : (
            <div>
              {items
                .filter((i) => i.count > 0)
                .map((i) => (
                  <Link
                    key={i.key}
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] transition hover:opacity-80"
                    style={{ borderBottom: "1px solid var(--border-subtle)", color: "var(--fg-1)" }}
                  >
                    <span>{LABEL_KEYS[i.key] ? t(LABEL_KEYS[i.key]) : i.label}</span>
                    <span
                      className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                      style={{ background: "var(--accent-primary)" }}
                    >
                      {i.count}
                    </span>
                  </Link>
                ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
