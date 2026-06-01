"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { ProductTypeTag } from "@/components/ui/badges";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import type { PortfolioResponse } from "@/lib/types/api";
import type { PortfolioSummary, ProductType } from "@/lib/types/domain";
import { formatDateTime, formatMoney, formatNumber, formatSignedMoney, productTypeLabel } from "@/lib/utils/format";
import { useI18n } from "@/contexts/i18n-context";

const assetClasses: Array<ProductType | "all"> = ["all", "stock", "fund", "sukuk", "crypto", "private"];

export default function ClientPortfolioPage() {
  const { t } = useI18n();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [filter, setFilter] = useState<ProductType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<PortfolioResponse>("/portfolio/me")
      .then((data) => setPortfolio(data.portfolio))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load portfolio"))
      .finally(() => setLoading(false));
  }, []);

  // Top gainer / loser by unrealized P/L percent.
  const movers = useMemo(() => {
    if (!portfolio || portfolio.holdings.length === 0) return { best: null, worst: null };
    const sorted = [...portfolio.holdings].sort((a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent);
    return { best: sorted[0], worst: sorted[sorted.length - 1] };
  }, [portfolio]);

  function exportCsv() {
    if (!portfolio) return;
    const headers = [
      "Product",
      "Symbol",
      "Type",
      "Quantity",
      "AvgPrice",
      "CurrentPrice",
      "CurrentValue",
      "Currency",
      "UnrealizedPnL",
      "UnrealizedPnL%",
      "Weight%",
      "PriceUpdatedAt"
    ];
    const rows = portfolio.holdings.map((h) => {
      const weight = portfolio.totalValue > 0 ? (h.currentValue / portfolio.totalValue) * 100 : 0;
      return [
        h.productName,
        h.symbol ?? "",
        h.type,
        h.quantity,
        h.avgPrice,
        h.currentPrice,
        h.currentValue,
        h.currency,
        h.unrealizedPnL,
        h.unrealizedPnLPercent.toFixed(2),
        weight.toFixed(2),
        h.priceUpdatedAt ?? ""
      ]
        .map((v) => {
          const s = String(v);
          return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingState label="Loading portfolio" />;
  if (error) return <ErrorState message={error} />;
  if (!portfolio) return <EmptyState title={t("dash.noData")} />;

  const holdings = filter === "all" ? portfolio.holdings : portfolio.holdings.filter((holding) => holding.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{t("port.title")}</h1>
          <p className="mt-1 text-[13px] text-slate-500">{t("port.subtitle")}</p>
        </div>
        <button className="btn btn-secondary" onClick={exportCsv}>
          <Download className="h-4 w-4" /> {t("port.export")}
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("dash.portfolioValue")} value={formatMoney(portfolio.totalValue)} sub={`${portfolio.positionCount} ${t("dash.positionsCount")}`} />
        <MetricCard
          label={t("dash.unrealizedPnl")}
          value={formatSignedMoney(portfolio.totalUnrealizedPnL)}
          tone={portfolio.totalUnrealizedPnL >= 0 ? "gain" : "loss"}
          sub={`${portfolio.totalUnrealizedPnLPercent.toFixed(2)}% ${t("dash.totalSuffix")}`}
        />
        <MetricCard label={t("port.assetClasses")} value={portfolio.assetClassCount} sub={t("port.byProductType")} />
        <MetricCard label={t("port.filteredRows")} value={holdings.length} sub={filter === "all" ? t("port.allHoldings") : productTypeLabel(filter)} />
      </section>

      {/* Top movers */}
      {movers.best || movers.worst ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(3,152,85,0.12)" }}>
              <ArrowUpRight className="h-5 w-5" style={{ color: "var(--gain)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] muted">{t("port.topGainer")}</div>
              {movers.best ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium" style={{ color: "var(--fg-1)" }}>{movers.best.productName}</span>
                  <span className="gain text-[13px] font-semibold">{movers.best.unrealizedPnLPercent >= 0 ? "+" : ""}{movers.best.unrealizedPnLPercent.toFixed(2)}%</span>
                </div>
              ) : <span className="text-[13px] muted">{t("port.none")}</span>}
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "rgba(217,45,32,0.12)" }}>
              <ArrowDownRight className="h-5 w-5" style={{ color: "var(--loss)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] muted">{t("port.topLoser")}</div>
              {movers.worst ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium" style={{ color: "var(--fg-1)" }}>{movers.worst.productName}</span>
                  <span className="loss text-[13px] font-semibold">{movers.worst.unrealizedPnLPercent >= 0 ? "+" : ""}{movers.worst.unrealizedPnLPercent.toFixed(2)}%</span>
                </div>
              ) : <span className="text-[13px] muted">{t("port.none")}</span>}
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{t("dash.holdings")}</div>
            <div className="flex flex-wrap gap-1">
              {assetClasses.map((assetClass) => (
                <button
                  key={assetClass}
                  className={`h-7 rounded border px-2.5 text-[11px] font-medium ${
                    filter === assetClass ? "border-navy-200 bg-navy-50 text-navy-700" : "border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() => setFilter(assetClass)}
                >
                  {assetClass === "all" ? t("common.all") : productTypeLabel(assetClass)}
                </button>
              ))}
            </div>
          </div>
          {holdings.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("tbl.instrument")}</th>
                    <th>{t("tbl.type")}</th>
                    <th className="text-right">{t("tbl.quantity")}</th>
                    <th className="text-right">{t("tbl.current")}</th>
                    <th className="text-right">{t("tbl.value")}</th>
                    <th className="text-right">{t("tbl.unrealizedPnl")}</th>
                    <th className="text-right">{t("port.weight")}</th>
                    <th>{t("tbl.priceTime")}</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => {
                    const weight = portfolio.totalValue > 0 ? (holding.currentValue / portfolio.totalValue) * 100 : 0;
                    return (
                      <tr key={holding.positionId}>
                        <td>
                          <div className="font-medium text-slate-900">{holding.productName}</div>
                          <div className="font-mono text-[10px] text-slate-500">{holding.symbol ?? "—"}
                            {holding.pricingMode === "api" ? (
                              <span className="ml-1 rounded bg-blue-50 px-1 text-[9px] text-blue-600">{t("port.live")}</span>
                            ) : (
                              <span className="ml-1 rounded bg-amber-50 px-1 text-[9px] text-amber-600">{t("port.manual")}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <ProductTypeTag type={holding.type} />
                        </td>
                        <td className="text-right">{formatNumber(holding.quantity, 4)}</td>
                        <td className="text-right">{formatNumber(holding.currentPrice)}</td>
                        <td className="text-right">{formatMoney(holding.currentValue, holding.currency)}</td>
                        <td className={holding.unrealizedPnL >= 0 ? "gain text-right font-medium" : "loss text-right font-medium"}>
                          {formatSignedMoney(holding.unrealizedPnL, holding.currency)}
                          <div className="text-[10px] opacity-70">{holding.unrealizedPnLPercent >= 0 ? "+" : ""}{holding.unrealizedPnLPercent.toFixed(2)}%</div>
                        </td>
                        <td className="text-right">
                          <div className="text-[12px] font-medium" style={{ color: "var(--fg-1)" }}>{weight.toFixed(1)}%</div>
                          <div className="mt-1 h-1 w-16 overflow-hidden rounded-full" style={{ background: "var(--bg-surface-3)", marginInlineStart: "auto" }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(weight, 100)}%`, background: "var(--accent-primary)" }} />
                          </div>
                        </td>
                        <td className="text-[11px]">{formatDateTime(holding.priceUpdatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={t("port.noMatch")} />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">{t("port.allocation")}</div>
          </div>
          <AllocationChart allocation={portfolio.allocation} />
        </div>
      </section>
    </div>
  );
}
