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
import { formatDate, formatDateTime, formatMoney, formatNumber, formatSignedMoney, productTypeLabel, titleCase } from "@/lib/utils/format";

export default function ClientDashboardPage() {
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
  if (!portfolio) return <EmptyState title="No portfolio data available" />;

  const openRequests = requests.filter((request) => request.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Good afternoon.</h1>
        <p className="mt-1 text-[13px] text-slate-500">Here is a summary of your portfolio as of today.
            {portfolio && portfolio.holdings.length > 0 && portfolio.holdings[0].priceUpdatedAt ? (
              <span className="ml-2 text-[11px] text-slate-400">
                Prices as of {formatDateTime(portfolio.holdings.reduce((latest: string, h: { priceUpdatedAt?: string | null }) =>
                  h.priceUpdatedAt && h.priceUpdatedAt > latest ? h.priceUpdatedAt : latest,
                  portfolio.holdings[0].priceUpdatedAt ?? ""
                ))}
              </span>
            ) : null}
          </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Portfolio value" value={formatMoney(portfolio.totalValue)} sub={`${portfolio.positionCount} positions`} />
        <MetricCard
          label="Unrealized P/L"
          value={formatSignedMoney(portfolio.totalUnrealizedPnL)}
          tone={portfolio.totalUnrealizedPnL >= 0 ? "gain" : "loss"}
          sub={`${portfolio.totalUnrealizedPnLPercent.toFixed(2)}% total`}
        />
        <MetricCard label="Positions" value={portfolio.positionCount} sub={`${portfolio.assetClassCount} asset classes`} />
        <MetricCard label="Open requests" value={openRequests} sub="Pending review" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Holdings</div>
            <Link className="text-[12px] font-medium text-navy-700 hover:underline" href="/client/portfolio">
              View all
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Avg price</th>
                  <th className="text-right">Current</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Unr. P/L</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.holdings.slice(0, 5).map((holding) => (
                  <tr key={holding.positionId}>
                    <td>
                      <div className="font-medium text-slate-900">{holding.productName}</div>
                      <div className="font-mono text-[10px] text-slate-500">{holding.symbol ?? productTypeLabel(holding.type)}</div>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Asset allocation</div>
          </div>
          <AllocationChart allocation={portfolio.allocation} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent requests</div>
            <Link className="btn btn-secondary h-8" href="/client/requests">
              <Send className="h-3.5 w-3.5" />
              Submit
            </Link>
          </div>
          {requests.length ? (
            <div>
              {requests.map((request) => (
                <div key={request.id} className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 last:border-0">
                  <span className="tag bg-navy-50 text-navy-700">{titleCase(request.type)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-slate-900">{request.productName ?? "Cash withdrawal"}</div>
                    <div className="text-[10px] text-slate-500">
                      {request.amount ? formatMoney(request.amount, request.currency) : "Amount not specified"} - {formatDate(request.createdAt)}
                    </div>
                  </div>
                  <RequestStatusBadge status={request.status} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No requests submitted" />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Statements</div>
            <Link className="text-[12px] font-medium text-navy-700 hover:underline" href="/client/statements">
              View all
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
                    <div className="truncate text-[12px] font-medium text-slate-900">{statement.period} Statement</div>
                    <div className="text-[10px] text-slate-500">Issued {formatDate(statement.createdAt)}</div>
                  </div>
                  <button className="btn btn-secondary h-8" onClick={() => downloadFromApi(`/statements/${statement.id}/download`, statement.fileName)}>
                    Download PDF
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No statements available" />
          )}
        </div>
      </section>
    </div>
  );
}
