"use client";

import { useEffect, useState } from "react";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { ProductTypeTag } from "@/components/ui/badges";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import type { PortfolioResponse } from "@/lib/types/api";
import type { PortfolioSummary, ProductType } from "@/lib/types/domain";
import { formatDateTime, formatMoney, formatNumber, formatSignedMoney, productTypeLabel } from "@/lib/utils/format";

const assetClasses: Array<ProductType | "all"> = ["all", "stock", "fund", "sukuk", "crypto", "private"];

export default function ClientPortfolioPage() {
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

  if (loading) return <LoadingState label="Loading portfolio" />;
  if (error) return <ErrorState message={error} />;
  if (!portfolio) return <EmptyState title="No portfolio data available" />;

  const holdings = filter === "all" ? portfolio.holdings : portfolio.holdings.filter((holding) => holding.type === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Portfolio</h1>
        <p className="mt-1 text-[13px] text-slate-500">Detailed holdings, latest prices, and unrealized P/L.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Portfolio value" value={formatMoney(portfolio.totalValue)} sub={`${portfolio.positionCount} positions`} />
        <MetricCard
          label="Unrealized P/L"
          value={formatSignedMoney(portfolio.totalUnrealizedPnL)}
          tone={portfolio.totalUnrealizedPnL >= 0 ? "gain" : "loss"}
          sub={`${portfolio.totalUnrealizedPnLPercent.toFixed(2)}% total`}
        />
        <MetricCard label="Asset classes" value={portfolio.assetClassCount} sub="By product type" />
        <MetricCard label="Filtered rows" value={holdings.length} sub={filter === "all" ? "All holdings" : productTypeLabel(filter)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Holdings</div>
            <div className="flex flex-wrap gap-1">
              {assetClasses.map((assetClass) => (
                <button
                  key={assetClass}
                  className={`h-7 rounded border px-2.5 text-[11px] font-medium ${
                    filter === assetClass ? "border-navy-200 bg-navy-50 text-navy-700" : "border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() => setFilter(assetClass)}
                >
                  {assetClass === "all" ? "All" : productTypeLabel(assetClass)}
                </button>
              ))}
            </div>
          </div>
          {holdings.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Type</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Average</th>
                    <th className="text-right">Current</th>
                    <th className="text-right">Value</th>
                    <th className="text-right">Unr. P/L</th>
                    <th>Price time</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => (
                    <tr key={holding.positionId}>
                      <td>
                        <div className="font-medium text-slate-900">{holding.productName}</div>
                        <div className="font-mono text-[10px] text-slate-500">{holding.symbol ?? holding.pricingMode}</div>
                      </td>
                      <td>
                        <ProductTypeTag type={holding.type} />
                      </td>
                      <td className="text-right">{formatNumber(holding.quantity, 4)}</td>
                      <td className="text-right">{formatNumber(holding.avgPrice)}</td>
                      <td className="text-right">{formatNumber(holding.currentPrice)}</td>
                      <td className="text-right">{formatMoney(holding.currentValue, holding.currency)}</td>
                      <td className={holding.unrealizedPnL >= 0 ? "gain text-right font-medium" : "loss text-right font-medium"}>
                        {formatSignedMoney(holding.unrealizedPnL, holding.currency)}
                      </td>
                      <td>{formatDateTime(holding.priceUpdatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No holdings match this filter" />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Allocation</div>
          </div>
          <AllocationChart allocation={portfolio.allocation} />
        </div>
      </section>
    </div>
  );
}
