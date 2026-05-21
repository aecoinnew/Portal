"use client";

import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { ActiveBadge, ProductTypeTag } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import type { PricingResponse, PricingRow } from "@/lib/types/api";
import { formatDateTime, formatNumber, titleCase } from "@/lib/utils/format";

export default function AdminPricingPage() {
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "manual" | "api">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<PricingResponse>("/pricing");
    setPricing(data.pricing);
    setDrafts(Object.fromEntries(data.pricing.map((row) => [row.productId, row.price == null ? "" : String(row.price)])));
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load pricing"))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => pricing.filter((row) => filter === "all" || row.pricingMode === filter), [filter, pricing]);

  async function updatePrice(row: PricingRow) {
    setSavingId(row.productId);
    setError(null);
    try {
      await apiRequest(`/pricing/${row.productId}`, {
        method: "PATCH",
        body: JSON.stringify({ price: Number(drafts[row.productId]) })
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update price");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <LoadingState label="Loading pricing" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Pricing</h1>
        <p className="mt-1 text-[13px] text-slate-500">Latest product prices and manual price updates.</p>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="card">
        <div className="card-header">
          <div className="card-title">Product pricing</div>
          <div className="flex gap-1">
            {(["all", "manual", "api"] as const).map((item) => (
              <button
                key={item}
                className={`h-7 rounded border px-2.5 text-[11px] font-medium ${
                  filter === item ? "border-navy-200 bg-navy-50 text-navy-700" : "border-slate-200 bg-white text-slate-600"
                }`}
                onClick={() => setFilter(item)}
              >
                {titleCase(item)}
              </button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Pricing</th>
                  <th className="text-right">Current price</th>
                  <th>Currency</th>
                  <th>Last updated</th>
                  <th>Status</th>
                  <th>Manual update</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.productId}>
                    <td className="font-medium text-slate-900">{row.productName}</td>
                    <td>
                      <ProductTypeTag type={row.type} />
                    </td>
                    <td>
                      <span className="tag bg-slate-100 text-slate-700">{titleCase(row.pricingMode)}</span>
                    </td>
                    <td className="text-right">{formatNumber(row.price ?? 0)}</td>
                    <td>{row.currency}</td>
                    <td>{row.updatedAt ? formatDateTime(row.updatedAt) : "-"}</td>
                    <td>
                      <ActiveBadge active={Boolean(row.isActive)} />
                    </td>
                    <td>
                      {row.pricingMode === "manual" ? (
                        <div className="flex items-center gap-2">
                          <input
                            className="input h-8 w-28"
                            type="number"
                            min="0"
                            step="0.01"
                            value={drafts[row.productId] ?? ""}
                            onChange={(event) => setDrafts((current) => ({ ...current, [row.productId]: event.target.value }))}
                          />
                          <button className="btn btn-primary h-8" disabled={savingId === row.productId} onClick={() => void updatePrice(row)}>
                            <Save className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">API priced</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No pricing rows found" />
        )}
      </div>
    </div>
  );
}
