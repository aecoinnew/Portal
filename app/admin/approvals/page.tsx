"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle, XCircle, Clock, Play } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { useAuth } from "@/contexts/auth-context";

type ApprovalRequest = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  requestedByUserId: string;
  requestedByName?: string;
  assignedRole: string | null;
  status: string;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string | null;
  decisionByUserId: string | null;
  decisionByName?: string;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  executedAt: string | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-600",
  executed: "bg-blue-100 text-blue-800"
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  cancelled: XCircle,
  executed: Play
};

const ACTION_LABELS: Record<string, string> = {
  "portfolio.position.upserted": "Create/Update Position",
  "portfolio.position.updated": "Update Position",
  "portfolio.position.deleted": "Delete Position",
  "price.updated": "Update Price",
  "statement.uploaded": "Upload Statement",
  "statement.deleted": "Delete Statement",
  "request.status.updated": "Update Request Status",
  "user.created": "Create User",
  "user.updated": "Update User",
  "settings.updated": "Update Settings"
};

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadApprovals();
  }, [filter]);

  async function loadApprovals() {
    setLoading(true);
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const data = await apiRequest<{ approvals: ApprovalRequest[] }>(`/approvals${params}`);
      setApprovals(data.approvals);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: "approve" | "reject" | "execute") {
    setActionLoading(id);
    try {
      await apiRequest(`/approvals/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
      await loadApprovals();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  const canAct = user?.role === "super_admin" || user?.role === "admin" || user?.role === "compliance" || user?.role === "operations" || user?.role === "finance";

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Approvals</h1>
          <p className="mt-1 text-sm text-slate-500">Maker-checker workflow requests</p>
        </div>
        <div className="flex gap-2">
          {["all", "pending", "approved", "rejected", "executed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-navy-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Clock className="mb-3 h-10 w-10" />
          <p className="text-sm">No approval requests found</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Requested By</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {approvals.map((a) => {
                const StatusIcon = STATUS_ICONS[a.status] || Clock;
                return (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">
                        {ACTION_LABELS[a.action] || a.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono">
                        {a.entityType}
                      </span>
                      <span className="ml-1 text-xs text-slate-400">{a.entityId}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {a.requestedByName || a.requestedByUserId}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[a.status] || "bg-slate-100 text-slate-600"}`}>
                        <StatusIcon className="h-3 w-3" />
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDate(a.createdAt)}</td>
                    <td className="px-4 py-3">
                      {a.status === "pending" && canAct && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleAction(a.id, "approve")}
                            disabled={actionLoading === a.id}
                            className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <CheckCircle className="h-3 w-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleAction(a.id, "reject")}
                            disabled={actionLoading === a.id}
                            className="flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </button>
                        </div>
                      )}
                      {a.status === "approved" && canAct && (
                        <button
                          onClick={() => handleAction(a.id, "execute")}
                          disabled={actionLoading === a.id}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Play className="h-3 w-3" />
                          Execute
                        </button>
                      )}
                      {(a.status === "rejected" || a.status === "executed" || a.status === "cancelled") && (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
