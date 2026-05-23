"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle, XCircle, Clock, Play, Eye, EyeOff, Search } from "lucide-react";
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
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  cancelled: "bg-slate-100 text-slate-600",
  executing: "bg-blue-100 text-blue-700",
  executed: "bg-blue-200 text-blue-900"
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  approved: CheckCircle,
  rejected: XCircle,
  cancelled: XCircle,
  executing: Play,
  executed: Play
};

const ACTION_LABELS: Record<string, string> = {
  "portfolio.position.upserted": "Create / Update Position",
  "portfolio.position.updated": "Update Position",
  "portfolio.position.deleted": "Delete Position",
  "price.updated": "Update Price",
  "statement.uploaded": "Upload Statement",
  "statement.deleted": "Delete Statement",
  "request.status.updated": "Update Request Status",
  "user.created": "Create User",
  "user.updated": "Update User",
  "settings.updated": "Update Settings",
  "product.created": "Create Product",
  "product.config.updated": "Update Product Config"
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function formatJsonForDisplay(jsonStr: string | null): string {
  if (!jsonStr) return "—";
  try {
    const obj = JSON.parse(jsonStr);
    // Remove fields that shouldn't be shown to a checker (e.g. password hash)
    if (typeof obj === "object" && obj !== null) {
      const safe: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (k === "passwordHash" || k === "password_hash" || k === "password") {
          safe[k] = "[redacted]";
        } else {
          safe[k] = v;
        }
      }
      return JSON.stringify(safe, null, 2);
    }
    return JSON.stringify(obj, null, 2);
  } catch {
    return jsonStr;
  }
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      const body = action === "reject" ? { reason: prompt("Rejection reason (optional):") || "" } : {};
      await apiRequest(`/approvals/${id}/${action}`, { method: "POST", body: JSON.stringify(body) });
      await loadApprovals();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApproveAndExecute(id: string) {
    setActionLoading(id);
    try {
      await apiRequest(`/approvals/${id}/approve`, { method: "POST", body: JSON.stringify({}) });
      await apiRequest(`/approvals/${id}/execute`, { method: "POST", body: JSON.stringify({}) });
      await loadApprovals();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Approve+Execute failed");
      await loadApprovals();
    } finally {
      setActionLoading(null);
    }
  }

  const canAct = user?.role === "super_admin" || user?.role === "admin" ||
                 user?.role === "compliance" || user?.role === "operations" ||
                 user?.role === "finance";

  // Filter by search (id, action, requester name, entity id)
  const filteredApprovals = useMemo(() => {
    if (!search.trim()) return approvals;
    const q = search.toLowerCase();
    return approvals.filter((a) =>
      a.id.toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q) ||
      a.entityId.toLowerCase().includes(q) ||
      (a.requestedByName ?? "").toLowerCase().includes(q) ||
      a.entityType.toLowerCase().includes(q)
    );
  }, [approvals, search]);

  // Counts per status (for filter pills)
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: approvals.length, pending: 0, approved: 0, rejected: 0, executed: 0, cancelled: 0, executing: 0 };
    for (const a of approvals) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [approvals]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Approvals</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Maker-checker workflow queue. The maker cannot approve or execute their own request.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search id, action, requester..."
              className="input h-8 pl-8 w-64 text-[12px]"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {["all", "pending", "approved", "rejected", "executed", "cancelled"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 rounded border px-3 text-[12px] font-medium capitalize ${
              filter === f
                ? "border-navy-200 bg-navy-50 text-navy-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f} <span className="ml-1 text-slate-400">({counts[f] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Queue ({filteredApprovals.length})</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-navy-700 border-t-transparent" />
          </div>
        ) : filteredApprovals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Clock className="mb-3 h-10 w-10" />
            <p className="text-sm">No approval requests {filter !== "all" ? `in ${filter}` : "found"}</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Requested by</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Decision</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovals.map((a) => {
                  const StatusIcon = STATUS_ICONS[a.status] || Clock;
                  const isExpanded = expandedId === a.id;
                  return (
                    <>
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td>
                          <div className="font-medium text-slate-900">{ACTION_LABELS[a.action] || a.action}</div>
                          <div className="font-mono text-[10px] text-slate-400">{a.id}</div>
                        </td>
                        <td>
                          <div className="text-[12px]">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{a.entityType}</span>
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">{a.entityId}</div>
                        </td>
                        <td className="text-[12px] text-slate-700">
                          {a.requestedByName ?? a.requestedByUserId}
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[a.status] || "bg-slate-100 text-slate-600"}`}>
                            <StatusIcon className="h-3 w-3" />
                            {a.status}
                          </span>
                        </td>
                        <td className="text-[11px] text-slate-500">{formatDate(a.createdAt)}</td>
                        <td className="text-[11px] text-slate-500">
                          {a.decisionByName ?? a.decisionByUserId ?? "—"}
                          {a.decidedAt ? <div className="text-[10px] text-slate-400">{formatDate(a.decidedAt)}</div> : null}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : a.id)}
                              className="text-[11px] font-medium text-slate-600 hover:text-navy-700"
                              title={isExpanded ? "Hide details" : "Show details"}
                            >
                              {isExpanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            </button>
                            {a.status === "pending" && canAct ? (
                              <>
                                <button
                                  onClick={() => handleApproveAndExecute(a.id)}
                                  disabled={actionLoading === a.id}
                                  className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                                  title="Approve and execute in one step"
                                >
                                  <CheckCircle className="inline h-3 w-3" /> Approve & execute
                                </button>
                                <button
                                  onClick={() => handleAction(a.id, "approve")}
                                  disabled={actionLoading === a.id}
                                  className="rounded border border-emerald-200 bg-white px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                  title="Approve only (execute later)"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction(a.id, "reject")}
                                  disabled={actionLoading === a.id}
                                  className="rounded bg-rose-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  <XCircle className="inline h-3 w-3" /> Reject
                                </button>
                              </>
                            ) : null}
                            {a.status === "approved" && canAct ? (
                              <button
                                onClick={() => handleAction(a.id, "execute")}
                                disabled={actionLoading === a.id}
                                className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Play className="inline h-3 w-3" /> Execute
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={7} className="bg-slate-50 p-0">
                            <div className="grid gap-3 p-4 text-[12px]">
                              <div className="grid gap-3 lg:grid-cols-2">
                                <div>
                                  <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Before</div>
                                  <pre className="rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700 overflow-x-auto">{formatJsonForDisplay(a.beforeValue)}</pre>
                                </div>
                                <div>
                                  <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">After</div>
                                  <pre className="rounded border border-slate-200 bg-white p-2 font-mono text-[11px] text-slate-700 overflow-x-auto">{formatJsonForDisplay(a.afterValue)}</pre>
                                </div>
                              </div>
                              {a.reason ? (
                                <div>
                                  <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Maker reason</div>
                                  <div className="rounded border border-slate-200 bg-white p-2">{a.reason}</div>
                                </div>
                              ) : null}
                              {a.decisionReason ? (
                                <div>
                                  <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Decision reason</div>
                                  <div className="rounded border border-slate-200 bg-white p-2">{a.decisionReason}</div>
                                </div>
                              ) : null}
                              <div className="grid gap-2 text-[10px] text-slate-500 lg:grid-cols-3">
                                <div><span className="font-semibold">Created:</span> {formatDate(a.createdAt)}</div>
                                <div><span className="font-semibold">Decided:</span> {formatDate(a.decidedAt)}</div>
                                <div><span className="font-semibold">Executed:</span> {formatDate(a.executedAt)}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
