"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminAllocationChart, ClientAumChart, RequestStatusChart } from "@/components/charts/admin-dashboard-charts";
import { ProductTypeTag, RequestStatusBadge } from "@/components/ui/badges";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import type { AdminPosition, AdminSummaryResponse, PositionsResponse, PricingResponse, RequestsResponse } from "@/lib/types/api";
import type { AdminSummary, InvestmentRequest, ProductType, RequestStatus } from "@/lib/types/domain";
import type { PricingRow } from "@/lib/types/api";
import { formatDate, formatDateTime, formatMoney, formatNumber, titleCase } from "@/lib/utils/format";

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [pendingRequests, setPendingRequests] = useState<InvestmentRequest[]>([]);
  const [requests, setRequests] = useState<InvestmentRequest[]>([]);
  const [positions, setPositions] = useState<AdminPosition[]>([]);
  const [pricing, setPricing] = useState<PricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [summaryData, requestsData, pricingData, positionsData] = await Promise.all([
        apiRequest<AdminSummaryResponse>("/admin/summary"),
        apiRequest<RequestsResponse>("/requests"),
        apiRequest<PricingResponse>("/pricing"),
        apiRequest<PositionsResponse>("/portfolio/positions")
      ]);
      setSummary(summaryData.summary);
      setRequests(requestsData.requests);
      setPendingRequests(requestsData.requests.filter((request) => request.status === "pending").slice(0, 5));
      setPricing(pricingData.pricing.slice(0, 6));
      setPositions(positionsData.positions);
    }
    load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load admin dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Loading admin dashboard" />;
  if (error) return <ErrorState message={error} />;
  if (!summary) return <EmptyState title="No admin summary available" />;

  const clientAum = Object.values(
    positions.reduce<Record<string, { clientName: string; value: number; currency: "AED" | "USD" }>>((acc, position) => {
      const row = acc[position.userId] ?? { clientName: position.clientName, value: 0, currency: position.currency };
      row.value += position.marketValue;
      acc[position.userId] = row;
      return acc;
    }, {})
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const allocationTotal = positions.reduce((sum, position) => sum + position.marketValue, 0);
  const allocation = Object.values(
    positions.reduce<Record<ProductType, { type: ProductType; value: number; percentage: number }>>((acc, position) => {
      const row = acc[position.type] ?? { type: position.type, value: 0, percentage: 0 };
      row.value += position.marketValue;
      acc[position.type] = row;
      return acc;
    }, {} as Record<ProductType, { type: ProductType; value: number; percentage: number }>)
  )
    .map((row) => ({ ...row, percentage: allocationTotal ? (row.value / allocationTotal) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);

  const requestStatusMix = Object.values(
    requests.reduce<Record<RequestStatus, { status: RequestStatus; count: number }>>((acc, request) => {
      const row = acc[request.status] ?? { status: request.status, count: 0 };
      row.count += 1;
      acc[request.status] = row;
      return acc;
    }, {} as Record<RequestStatus, { status: RequestStatus; count: number }>)
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total AUM" value={formatMoney(summary.totalAum)} sub={`Across ${summary.totalClients} clients`} compact />
        <MetricCard label="Active clients" value={summary.activeClients} sub={`${summary.suspendedClients} suspended`} />
        <MetricCard label="Pending requests" value={summary.pendingRequests} tone={summary.pendingRequests ? "warning" : undefined} sub="Awaiting review" />
        <MetricCard label="Active products" value={summary.activeProducts} sub={`${summary.manualProducts} manual price`} />
        <MetricCard label="Stale prices" value={summary.stalePrices} tone={summary.stalePrices ? "warning" : undefined} sub="Manual products over 24h" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_340px_340px]">
        <div className="card">
          <div className="card-header">
            <div className="card-title">AUM by client</div>
          </div>
          <ClientAumChart data={clientAum} />
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Asset allocation</div>
          </div>
          <AdminAllocationChart data={allocation} />
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Request status</div>
          </div>
          <RequestStatusChart data={requestStatusMix} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Pending requests</div>
            <Link className="text-[12px] font-medium text-navy-700 hover:underline" href="/admin/requests">
              View all
            </Link>
          </div>
          {pendingRequests.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ref</th>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Product</th>
                    <th className="text-right">Amount</th>
                    <th>Submitted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="font-mono text-[10px] text-slate-500">{request.id.slice(-8).toUpperCase()}</td>
                      <td className="font-medium text-slate-900">{request.clientName}</td>
                      <td>
                        <span className="tag bg-navy-50 text-navy-700">{titleCase(request.type)}</span>
                      </td>
                      <td>{request.productName ?? "Cash"}</td>
                      <td className="text-right">{request.amount ? formatMoney(request.amount, request.currency) : "-"}</td>
                      <td>{formatDate(request.createdAt)}</td>
                      <td>
                        <RequestStatusBadge status={request.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No pending requests" />
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent activity</div>
          </div>
          {summary.recentActivity.length ? (
            <div className="divide-y divide-slate-100">
              {summary.recentActivity.map((activity) => (
                <div key={activity.id} className="px-5 py-3">
                  <div className="text-[12px] leading-5 text-slate-700">
                    <span className="font-medium text-slate-900">{titleCase(activity.action)}</span> on {activity.entityType}
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">{formatDateTime(activity.createdAt)}</div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No activity yet" />
          )}
        </div>
      </section>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Product pricing</div>
          <Link className="btn btn-primary h-8" href="/admin/pricing">
            Update manual price
          </Link>
        </div>
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
              </tr>
            </thead>
            <tbody>
              {pricing.map((row) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
