"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Send } from "lucide-react";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { ProductTypeTag, RequestStatusBadge } from "@/components/ui/badges";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest, downloadFromApi } from "@/lib/api/client";
import type { PortfolioResponse, RequestsResponse, StatementsResponse } from "@/lib/types/api";
import type { InvestmentRequest, PortfolioSummary, Statement } from "@/lib/types/domain";
import { formatDate, formatDateTime, formatMoney, formatSignedMoney, titleCase } from "@/lib/utils/format";
import { useI18n } from "@/contexts/i18n-context";

export default function ClientDashboardPage() {
  const { t } = useI18n();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [requests, setRequests] = useState<InvestmentRequest[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [portfolioData, requestsData, statementsData] = await Promise.all([
          apiRequest<PortfolioResponse>("/portfolio/me"),
          apiRequest<RequestsResponse>("/requests"),
          apiRequest<StatementsResponse>("/statements")
        ]);
        setPortfolio(portfolioData.portfolio);
        setRequests(requestsData.requests.slice(0, 4));
        setStatements(statementsData.statements.slice(0, 3));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading) return <LoadingState label="Loading dashboard" />;
  if (error) return <ErrorState message={error} />;
  if (!portfolio) return <EmptyState title={t("dash.noData")} />;

  const openRequests = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">{t("dash.greeting")}</h1>
        <p className="mt-1 text-[13px] text-slate-500">{t("dash.summary")}
            {portfolio && portfolio.holdings.length > 0 && portfolio.holdings[0].priceUpdatedAt ? (
              <span className="ml-2 text-[11px] text-slate-400">
                {t("dash.pricesAsOf")} {formatDateTime(portfolio.holdings.reduce((latest: string, h: { priceUpdatedAt?: string | null }) =>
                  h.priceUpdatedAt && h.priceUpdatedAt > latest ? h.priceUpdatedAt : latest,
                  portfolio.holdings[0].priceUpdatedAt ?? ""
                ))}
              </span>
            ) : null}
          </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label={t("dash.portfolioValue")} value={formatMoney(portfolio.totalValue)} sub={`${portfolio.positionCount} ${t("dash.positionsCount")}`} />
        <MetricCard
          label={t("dash.unrealizedPnl")}
          value={formatSignedMoney(portfolio.totalUnrealizedPnL)}
          tone={portfolio.totalUnrealizedPnL >= 0 ? "gain" : "loss"}
          sub={`${portfolio.totalUnrealizedPnLPercent.toFixed(2)}% ${t("dash.totalSuffix")}`}
        />
        <MetricCard label={t("dash.positions")} value={portfolio.positionCount} sub={`${portfolio.assetClassCount} ${t("dash.assetClasses")}`} />
        <MetricCard label={t("dash.openRequests")} value={openRequests} sub={t("dash.pendingReview")} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{t("dash.topHoldings")}</div>
            <Link className="text-[12px] font-medium text-navy-700 hover:underline" href="/client/portfolio">
              {t("dash.viewFullPortfolio")}
            </Link>
          </div>
          {portfolio.holdings.length ? (
            <div>
              {[...portfolio.holdings]
                .sort((a, b) => b.currentValue - a.currentValue)
                .slice(0, 4)
                .map((holding) => {
                  const weight = portfolio.totalValue > 0 ? (holding.currentValue / portfolio.totalValue) * 100 : 0;
                  return (
                    <div key={holding.positionId} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[13px] font-medium text-slate-900">{holding.productName}</span>
                          <ProductTypeTag type={holding.type} />
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--bg-surface-3)" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.min(weight, 100)}%`, background: "var(--accent-primary)" }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[13px] font-medium text-slate-900">{formatMoney(holding.currentValue, holding.currency)}</div>
                        <div className={holding.unrealizedPnL >= 0 ? "gain text-[11px]" : "loss text-[11px]"}>
                          {weight.toFixed(1)}% · {holding.unrealizedPnLPercent >= 0 ? "+" : ""}{holding.unrealizedPnLPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <EmptyState title={t("dash.noData")} />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">{t("dash.assetAllocation")}</div>
          </div>
          <AllocationChart allocation={portfolio.allocation} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">{t("dash.recentRequests")}</div>
            <Link className="btn btn-secondary h-8" href="/client/requests">
              <Send className="h-3.5 w-3.5" />
              {t("common.submit")}
            </Link>
          </div>
          {requests.length ? (
            <div>
              {requests.map((request) => (
                <div key={request.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                  <span className="tag bg-navy-50 text-navy-700">{titleCase(request.type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-slate-900">{request.productName ?? t("dash.cashWithdrawal")}</div>
                    <div className="text-[10px] text-slate-500">
                      {request.amount ? formatMoney(request.amount, request.currency) : t("dash.amountNotSpecified")} - {formatDate(request.createdAt)}
                    </div>
                  </div>
                  <RequestStatusBadge status={request.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t("dash.noRequests")} />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">{t("dash.statements")}</div>
            <Link className="text-[12px] font-medium text-navy-700 hover:underline" href="/client/statements">
              {t("common.viewAll")}
            </Link>
          </div>
          {statements.length ? (
            <div>
              {statements.map((statement) => (
                <div key={statement.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-50 text-navy-700">
                    <Download className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-slate-900">{statement.period} {t("dash.statementSuffix")}</div>
                    <div className="text-[10px] text-slate-500">{t("dash.issued")} {formatDate(statement.createdAt)}</div>
                  </div>
                  <button className="btn btn-secondary h-8" onClick={() => downloadFromApi(`/statements/${statement.id}/download`, statement.fileName)}>
                    {t("common.download")}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title={t("dash.noStatements")} />
          )}
        </div>
      </section>
    </div>
  );
}
