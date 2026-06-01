"use client";

import { useCallback, useEffect, useState } from "react";
import { ScrollText, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/api/client";
import { useAuth } from "@/contexts/auth-context";
import { ErrorState, LoadingState } from "@/components/ui/state";

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  adminId: string | null;
  adminName: string | null;
  adminEmail: string | null;
  adminRole: string | null;
  metadata: unknown;
  createdAt: string;
};

const PAGE_SIZE = 50;
const AUDIT_ROLES = ["super_admin", "admin", "compliance", "auditor"];

export default function AuditPage() {
  const { user } = useAuth();
  const allowed = user ? AUDIT_ROLES.includes(user.role) : false;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(
    async (newOffset: number) => {
      setError(null);
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(newOffset));
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      if (q.trim()) params.set("q", q.trim());
      const data = await apiRequest<{ total: number; logs: AuditLog[] }>(`/audit?${params.toString()}`);
      setLogs(data.logs);
      setTotal(data.total);
      setOffset(newOffset);
    },
    [action, entityType, q]
  );

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    apiRequest<{ actions: string[]; entityTypes: string[] }>("/audit/actions")
      .then((d) => {
        setActions(d.actions);
        setEntityTypes(d.entityTypes);
      })
      .catch(() => {});
    load(0)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [allowed, load]);

  function applyFilters() {
    setLoading(true);
    load(0)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }

  if (!allowed) {
    return (
      <div className="space-y-3">
        <h1 className="page-title">Audit Log</h1>
        <ErrorState message="You do not have permission to view the audit log." />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading audit log" />;

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5" style={{ color: "var(--accent-primary)" }} />
        <div>
          <h1 className="page-title">Audit Log</h1>
          <p className="mt-1 text-[13px] muted">
            A complete, immutable record of administrative actions. {total.toLocaleString()} entries.
          </p>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {/* Filters */}
      <section className="card">
        <div className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <label className="label">Action</label>
            <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Entity type</label>
            <select className="select" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
              <option value="">All types</option>
              {entityTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Search</label>
            <input
              className="input"
              placeholder="entity id, user, metadata…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
            />
          </div>
          <div className="flex items-end">
            <button className="btn btn-primary w-full" type="button" onClick={applyFilters}>
              <RefreshCw className="h-4 w-4" /> Apply
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Entity</th>
                <th>By</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-[12px] muted">
                    No audit entries match the current filters.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-[11px]">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td className="text-[12px] font-medium">{l.action}</td>
                    <td className="text-[11px]">
                      <div>{l.entityType}</div>
                      <div className="text-slate-400">{l.entityId}</div>
                    </td>
                    <td className="text-[11px]">
                      {l.adminName ?? l.adminEmail ?? l.adminId ?? "—"}
                      {l.adminRole ? <div className="text-slate-400">{l.adminRole}</div> : null}
                    </td>
                    <td className="max-w-[320px] text-[11px]">
                      {l.metadata ? (
                        <code className="block truncate" title={JSON.stringify(l.metadata)}>
                          {JSON.stringify(l.metadata)}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t p-3 text-[12px]" style={{ borderColor: "var(--border-subtle)" }}>
          <span className="muted">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              disabled={offset === 0}
              onClick={() => {
                setLoading(true);
                load(Math.max(0, offset - PAGE_SIZE)).finally(() => setLoading(false));
              }}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              className="btn btn-secondary"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => {
                setLoading(true);
                load(offset + PAGE_SIZE).finally(() => setLoading(false));
              }}
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
