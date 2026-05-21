"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Download, FileUp, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PendingApprovalBanner } from "@/components/ui/pending-approval-banner";
import { apiRequest, downloadFromApi } from "@/lib/api/client";
import type { ClientsResponse, StatementResponse, StatementsResponse } from "@/lib/types/api";
import type { ClientUser, Statement } from "@/lib/types/domain";
import { formatDate, formatNumber } from "@/lib/utils/format";

export default function AdminStatementsPage() {
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [userId, setUserId] = useState("");
  const [period, setPeriod] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [clientFilter, setClientFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  const activeClients = useMemo(() => clients.filter((client) => client.status === "active"), [clients]);
  const rows = useMemo(
    () => statements.filter((statement) => clientFilter === "all" || statement.userId === clientFilter),
    [clientFilter, statements]
  );

  async function load() {
    const [clientsData, statementsData] = await Promise.all([
      apiRequest<ClientsResponse>("/clients"),
      apiRequest<StatementsResponse>("/statements")
    ]);
    setClients(clientsData.clients);
    setStatements(statementsData.statements);
    setUserId((current) => current || clientsData.clients[0]?.id || "");
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load statements"))
      .finally(() => setLoading(false));
  }, []);

  async function uploadStatement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a PDF statement before uploading.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("userId", userId);
      form.set("period", period);
      form.set("file", file);

      const data = await apiRequest<StatementResponse & { pending?: boolean; approvalId?: string }>("/statements", {
        method: "POST",
        body: form
      });
      if (data.pending && data.approvalId) {
        setPendingApprovalId(data.approvalId);
        // statement is in quarantine, no DB row yet - do not append to local list
      } else {
        setPendingApprovalId(null);
      }

      setStatements((current) => [data.statement, ...current]);
      setPeriod("");
      setFile(null);
      const input = document.getElementById("statement-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload statement");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStatement(statement: Statement) {
    const resp = await apiRequest<{ pending?: boolean; approvalId?: string }>(`/statements/${statement.id}`, { method: "DELETE" });
    if (resp?.pending && resp.approvalId) {
      setPendingApprovalId(resp.approvalId);
      return;
    }
    setPendingApprovalId(null);
    setStatements((current) => current.filter((item) => item.id !== statement.id));
  }

  if (loading) return <LoadingState label="Loading statements" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Statements</h1>
        <p className="mt-1 text-[13px] text-slate-500">Upload and manage client PDF statements.</p>
      </div>

      {pendingApprovalId ? <PendingApprovalBanner approvalId={pendingApprovalId} /> : null}
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <form className="card h-fit" onSubmit={uploadStatement}>
          <div className="card-header">
            <div className="card-title">Upload statement</div>
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="statement-client">
                Client
              </label>
              <select id="statement-client" className="select" value={userId} onChange={(event) => setUserId(event.target.value)} required>
                {activeClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="statement-period">
                Period
              </label>
              <input
                id="statement-period"
                className="input"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                placeholder="Q2 2026"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="statement-file">
                PDF file
              </label>
              <input
                id="statement-file"
                className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white text-[12px] text-slate-700 file:mr-3 file:h-10 file:border-0 file:bg-slate-100 file:px-3 file:text-[12px] file:font-medium file:text-slate-700"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                required
              />
            </div>
            <button className="btn btn-primary" disabled={submitting || !activeClients.length} type="submit">
              <FileUp className="h-4 w-4" />
              {submitting ? "Uploading" : "Upload PDF"}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Statement library</div>
            <select className="select h-8 w-44" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
              <option value="all">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          {rows.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Period</th>
                    <th>File</th>
                    <th className="text-right">Size</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((statement) => (
                    <tr key={statement.id}>
                      <td className="font-medium text-slate-900">{statement.clientName}</td>
                      <td>{statement.period}</td>
                      <td>{statement.fileName}</td>
                      <td className="text-right">{formatNumber(statement.fileSize / 1024, 1)} KB</td>
                      <td>{formatDate(statement.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button className="btn btn-secondary h-8 px-2" onClick={() => downloadFromApi(`/statements/${statement.id}/download`, statement.fileName)}>
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button className="btn btn-secondary h-8 px-2" onClick={() => void deleteStatement(statement)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No statements found" />
          )}
        </div>
      </section>
    </div>
  );
}
