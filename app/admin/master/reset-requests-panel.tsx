"use client";

import { useEffect, useState } from "react";
import { KeyRound, MailQuestion, X } from "lucide-react";
import { apiRequest } from "@/lib/api/client";

type ResetRequest = {
  id: string;
  email: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  status: string;
  createdAt: string;
};

export function ResetRequestsPanel({ onResetUser }: { onResetUser?: (userId: string) => void }) {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<{ requests: ResetRequest[] }>("/admin/master/reset-requests");
    setRequests(data.requests);
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function dismiss(id: string) {
    setError(null);
    try {
      await apiRequest(`/admin/master/reset-requests/${id}/dismiss`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dismiss failed");
    }
  }

  if (loading) return null;

  return (
    <section className="card">
      <div className="card-header flex items-center gap-2">
        <MailQuestion className="h-4 w-4" style={{ color: "var(--accent-primary)" }} />
        <div className="card-title">Password reset requests</div>
        {requests.length > 0 ? (
          <span className="tag bg-amber-100 text-amber-800 ml-2">{requests.length} pending</span>
        ) : null}
      </div>

      <div className="p-5">
        {error ? (
          <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-[12px] text-rose-800">
            {error}
          </div>
        ) : null}

        {requests.length === 0 ? (
          <div className="text-[13px] muted">No pending password reset requests.</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Email</th>
                  <th>User</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td className="text-[11px]">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="text-[12px]">{r.email}</td>
                    <td className="text-[12px]">
                      {r.userName ?? "—"}
                      {r.userRole ? <div className="text-slate-400">{r.userRole}</div> : null}
                    </td>
                    <td className="space-x-2">
                      {r.userId && onResetUser ? (
                        <button
                          className="text-[11px] font-medium text-navy-700 hover:underline"
                          onClick={() => onResetUser(r.userId as string)}
                        >
                          <KeyRound className="inline h-3.5 w-3.5 mr-1" />
                          Reset password
                        </button>
                      ) : null}
                      <button
                        className="text-[11px] font-medium text-slate-500 hover:underline"
                        onClick={() => void dismiss(r.id)}
                      >
                        <X className="inline h-3.5 w-3.5 mr-1" />
                        Dismiss
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
