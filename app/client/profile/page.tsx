"use client";

import { useState, type FormEvent } from "react";
import { Moon, Sun, KeyRound, UserCircle, ShieldCheck, Languages } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useI18n } from "@/contexts/i18n-context";

export default function ClientProfilePage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, locale, setLocale } = useI18n();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwError(null);
    setPwNotice(null);

    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 12) {
      setPwError("New password must be at least 12 characters.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest<{ ok: boolean }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setPwNotice("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("profile.title")}</h1>
        <p className="mt-1 text-[13px] muted">{t("profile.subtitle")}</p>
      </div>

      {/* Profile info */}
      <section className="card">
        <div className="card-header flex items-center gap-2">
          <UserCircle className="h-4 w-4" style={{ color: "var(--accent-primary)" }} />
          <div className="card-title">{t("profile.account")}</div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <div className="label">{t("profile.name")}</div>
            <div className="text-[14px]" style={{ color: "var(--fg-1)" }}>
              {user?.name ?? "—"}
            </div>
          </div>
          <div>
            <div className="label">{t("profile.email")}</div>
            <div className="text-[14px]" style={{ color: "var(--fg-1)" }}>
              {user?.email ?? "—"}
            </div>
          </div>
          <div>
            <div className="label">{t("profile.accountType")}</div>
            <div className="text-[14px]" style={{ color: "var(--fg-1)" }}>
              {t("common.clientAccount")}
            </div>
          </div>
          <div>
            <div className="label">{t("profile.status")}</div>
            <span className="tag" style={{ background: "var(--accent-primary-soft)", color: "var(--accent-primary)" }}>
              {user?.status ?? "active"}
            </span>
          </div>
        </div>
      </section>

      {/* Appearance / theme */}
      <section className="card">
        <div className="card-header flex items-center gap-2">
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <div className="card-title">{t("profile.appearance")}</div>
        </div>
        <div className="flex items-center justify-between p-5">
          <div>
            <div className="text-[13px] font-medium" style={{ color: "var(--fg-1)" }}>
              {t("profile.darkMode")}
            </div>
            <div className="text-[12px] muted">
              {t("profile.darkModeDesc")}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={theme === "dark"}
            onClick={toggleTheme}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition"
            style={{ background: theme === "dark" ? "var(--accent-primary)" : "var(--slate-300)" }}
          >
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white transition"
              style={{ transform: theme === "dark" ? "translateX(22px)" : "translateX(2px)" }}
            />
          </button>
        </div>
      </section>

      {/* Language */}
      <section className="card">
        <div className="card-header flex items-center gap-2">
          <Languages className="h-4 w-4" />
          <div className="card-title">{t("profile.language")}</div>
        </div>
        <div className="flex items-center justify-between p-5">
          <div>
            <div className="text-[13px] font-medium" style={{ color: "var(--fg-1)" }}>
              {t("profile.language")}
            </div>
            <div className="text-[12px] muted">{t("profile.languageDesc")}</div>
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border" style={{ borderColor: "var(--border-subtle)" }}>
            <button
              type="button"
              onClick={() => setLocale("en")}
              className="px-4 py-1.5 text-[13px] font-medium transition"
              style={
                locale === "en"
                  ? { background: "var(--accent-primary)", color: "#fff" }
                  : { background: "var(--bg-surface)", color: "var(--fg-2)" }
              }
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLocale("ar")}
              className="px-4 py-1.5 text-[13px] font-medium transition"
              style={
                locale === "ar"
                  ? { background: "var(--accent-primary)", color: "#fff" }
                  : { background: "var(--bg-surface)", color: "var(--fg-2)" }
              }
            >
              العربية
            </button>
          </div>
        </div>
      </section>

      {/* Change password */}
      <section className="card">
        <div className="card-header flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          <div className="card-title">{t("profile.changePassword")}</div>
        </div>
        <form className="space-y-4 p-5" onSubmit={changePassword}>
          {pwError ? (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-[12px] text-rose-800">
              {pwError}
            </div>
          ) : null}
          {pwNotice ? (
            <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-[12px] text-green-800">
              {pwNotice}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">{t("profile.currentPassword")}</label>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{t("profile.newPassword")}</label>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={12}
              />
            </div>
            <div>
              <label className="label">{t("profile.confirmPassword")}</label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={12}
              />
            </div>
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            <ShieldCheck className="h-4 w-4" /> {saving ? "…" : t("profile.updatePassword")}
          </button>
        </form>
      </section>
    </div>
  );
}
