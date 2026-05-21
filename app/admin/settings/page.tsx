"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save, ShieldCheck } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import type { SettingsResponse } from "@/lib/types/api";
import type { AppSettings, SupportedCurrency } from "@/lib/types/domain";
import { formatDateTime } from "@/lib/utils/format";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [baseCurrency, setBaseCurrency] = useState<SupportedCurrency>("AED");
  const [allowUsd, setAllowUsd] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<SettingsResponse>("/settings")
      .then((data) => {
        setSettings(data.settings);
        setBaseCurrency(data.settings.baseCurrency);
        setAllowUsd(data.settings.allowUsd);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const data = await apiRequest<SettingsResponse>("/settings", {
        method: "PATCH",
        body: JSON.stringify({ baseCurrency, allowUsd })
      });
      setSettings(data.settings);
      setBaseCurrency(data.settings.baseCurrency);
      setAllowUsd(data.settings.allowUsd);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading settings" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-[13px] text-slate-500">Administrative controls for portal-wide currency behavior.</p>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form className="card h-fit" onSubmit={saveSettings}>
          <div className="card-header">
            <div className="card-title">Currency controls</div>
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="base-currency">
                Base currency
              </label>
              <select
                id="base-currency"
                className="select"
                value={baseCurrency}
                onChange={(event) => {
                  const next = event.target.value as SupportedCurrency;
                  setBaseCurrency(next);
                  if (next === "USD") setAllowUsd(true);
                }}
              >
                <option value="AED">AED</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-3 py-3">
              <span>
                <span className="block text-[13px] font-medium text-slate-900">Allow USD</span>
                <span className="block text-[11px] text-slate-500">Controls whether admins and clients can select USD.</span>
              </span>
              <input
                className="h-4 w-4 accent-navy-700"
                type="checkbox"
                checked={allowUsd}
                onChange={(event) => setAllowUsd(event.target.checked || baseCurrency === "USD")}
                disabled={baseCurrency === "USD"}
              />
            </label>
            <button className="btn btn-primary" disabled={saving} type="submit">
              <Save className="h-4 w-4" />
              {saving ? "Saving" : "Save settings"}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Current policy</div>
          </div>
          <div className="grid gap-3 p-5 text-[13px]">
            <div className="flex items-center gap-2 text-slate-700">
              <ShieldCheck className="h-4 w-4 text-navy-700" />
              Product currencies are limited to AED and USD.
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Base currency</div>
              <div className="mt-1 font-medium text-slate-900">{settings?.baseCurrency ?? baseCurrency}</div>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">USD availability</div>
              <div className="mt-1 font-medium text-slate-900">{settings?.allowUsd ? "Enabled" : "Disabled"}</div>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-slate-500">Updated</div>
              <div className="mt-1 font-medium text-slate-900">{settings ? formatDateTime(settings.updatedAt) : "-"}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
