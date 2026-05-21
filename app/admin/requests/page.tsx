"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FileCheck2, X } from "lucide-react";
import { RequestStatusBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PendingApprovalBanner } from "@/components/ui/pending-approval-banner";
import { apiRequest } from "@/lib/api/client";
import type { ClientsResponse, RequestResponse, RequestsResponse } from "@/lib/types/api";
import type { ClientUser, InvestmentRequest, RequestStatus } from "@/lib/types/domain";
import { formatDate, formatMoney, titleCase } from "@/lib/utils/format";

const statuses: Array<RequestStatus | "all"> = ["all", "pending", "approved", "rejected", "executed"];

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<InvestmentRequest[]>([]);
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const [clientId, setClientId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  async function load() {
    const [requestsData, clientsData] = await Promise.all([
      apiRequest<RequestsResponse>("/requests"),
      apiRequest<ClientsResponse>("/clients")
    ]);
    setRequests(requestsData.requests);
    setClients(clientsData.clients);
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load requests"))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(
    () =>
      requests.filter((request) => {
        if (status !== "all" && request.status !== status) return false;
        if (clientId !== "all" && request.userId !== clientId) return false;
        return true;
      }),
    [clientId, requests, status]
  );

  async function setRequestStatus(request: InvestmentRequest, nextStatus: Exclude<RequestStatus, "pending">) {
    const rejectionReason =
      nextStatus === "rejected" ? window.prompt("Rejection reason", request.rejectionReason ?? "Rejected by administrator") : null;
    if (nextStatus === "rejected" && !rejectionReason) return;

    const data = await apiRequest<RequestResponse & { pending?: boolean; approvalId?: string }>(`/requests/${request.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus, rejectionReason })
    });
    if (data.pending && data.approvalId) {
      setPendingApprovalId(data.approvalId);
      return;
    }
    setPendingApprovalId(null);
    if (data.request) {
      setRequests((current) => current.map((item) => (item.id === request.id ? data.request : item)));
    }
  }

  if (loading) return <LoadingState label="Loading requests" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Requests</h1>
        <p className="mt-1 text-[13px] text-slate-500">Review, approve, reject, and mark investment requests as executed.</p>
      </div>

      {pendingApprovalId ? <PendingApprovalBanner approvalId={pendingApprovalId} /> : null}
      {error ? <ErrorState message={error} /> : null}

      <div className="card">
        <div className="card-header flex-wrap">
          <div className="card-title">All requests</div>
          <div className="flex flex-wrap gap-2">
            <select className="select h-8 w-44" value={clientId} onChange={(event) => setClientId(event.target.value)}>
              <option value="all">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              {statuses.map((item) => (
                <button
                  key={item}
                  className={`h-8 rounded border px-2.5 text-[11px] font-medium ${
                    status === item ? "border-navy-200 bg-navy-50 text-navy-700" : "border-slate-200 bg-white text-slate-600"
                  }`}
                  onClick={() => setStatus(item)}
                >
                  {titleCase(item)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {rows.length ? (
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
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
                    <td>
                      <div className="flex items-center gap-2">
                        <button className="btn btn-secondary h-8 px-2" onClick={() => void setRequestStatus(request, "approved")}>
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn btn-secondary h-8 px-2" onClick={() => void setRequestStatus(request, "executed")}>
                          <FileCheck2 className="h-3.5 w-3.5" />
                        </button>
                        <button className="btn btn-secondary h-8 px-2" onClick={() => void setRequestStatus(request, "rejected")}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No requests match the current filters" />
        )}
      </div>
    </div>
  );
}
