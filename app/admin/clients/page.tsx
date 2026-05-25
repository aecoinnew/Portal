"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Save, X } from "lucide-react";
import { UserStatusBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PendingApprovalBanner } from "@/components/ui/pending-approval-banner";
import { apiRequest } from "@/lib/api/client";
import type { ClientResponse, ClientsResponse } from "@/lib/types/api";
import type { ClientUser, UserRole, UserStatus } from "@/lib/types/domain";
import { formatDate, titleCase } from "@/lib/utils/format";

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("EisaX#2026");
  const [role, setRole] = useState<UserRole>("client");
  const [phone, setPhone] = useState("");
  const [relationshipManager, setRelationshipManager] = useState("");
  const [status, setStatusValue] = useState<UserStatus>("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);

  async function load() {
    const data = await apiRequest<ClientsResponse>("/clients");
    setClients(data.clients);
  }

  useEffect(() => {
    load()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load clients"))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("EisaX#2026");
    setRole("client");
    setStatusValue("active");
    setPhone("");
    setRelationshipManager("");
    setEditingId(null);
  }

  function editClient(client: ClientUser) {
    setEditingId(client.id);
    setName(client.name);
    setEmail(client.email);
    setPassword("");
    setRole(client.role);
    setStatusValue(client.status);
    setPhone(client.phone ?? "");
    setRelationshipManager(client.relationshipManager ?? "");
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        name,
        email,
        ...(password ? { password } : {}),
        role,
        status,
        phone: phone || null,
        relationshipManager: relationshipManager || null
      };
      const data = await apiRequest<ClientResponse & { pending?: boolean; approvalId?: string }>(editingId ? `/clients/${editingId}` : "/clients", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload)
      });
      if (data.pending && data.approvalId) {
        setPendingApprovalId(data.approvalId);
        resetForm();
        return;
      }
      setPendingApprovalId(null);
      setClients((current) => {
        const next = editingId ? current.map((item) => (item.id === editingId ? data.client : item)) : [...current, data.client];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      resetForm();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to save client");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(client: ClientUser, status: UserStatus) {
    const data = await apiRequest<ClientResponse & { pending?: boolean; approvalId?: string }>(`/clients/${client.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
    if (data.pending && data.approvalId) {
      setPendingApprovalId(data.approvalId);
      return;
    }
    setPendingApprovalId(null);
    setClients((current) => current.map((item) => (item.id === client.id ? data.client : item)));
  }

  if (loading) return <LoadingState label="Loading clients" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Clients</h1>
        <p className="mt-1 text-[13px] text-slate-500">Client records and login-linked user accounts.</p>
      </div>

      {pendingApprovalId ? <PendingApprovalBanner approvalId={pendingApprovalId} /> : null}
      {error ? <ErrorState message={error} /> : null}

      <section className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form className="card h-fit" onSubmit={saveClient}>
          <div className="card-header">
            <div className="card-title">{editingId ? "Edit client" : "New client"}</div>
            {editingId ? (
              <button className="btn btn-secondary h-8 px-2" type="button" onClick={resetForm} title="Cancel edit">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="client-name">
                Name
              </label>
              <input id="client-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="client-email">
                Email
              </label>
              <input id="client-email" className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="client-password">
                  Password
                </label>
                <input id="client-password" className="input" value={password} onChange={(event) => setPassword(event.target.value)} required={!editingId} placeholder={editingId ? "Leave blank" : ""} />
              </div>
              <div>
                <label className="label" htmlFor="client-role">
                  Role
                </label>
                <select id="client-role" className="select" value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
                  <option value="client">Client</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="client-status">
                Status
              </label>
              <select id="client-status" className="select" value={status} onChange={(event) => setStatusValue(event.target.value as UserStatus)}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="client-phone">
                Phone
              </label>
              <input id="client-phone" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="client-rm">
                Relationship manager
              </label>
              <input id="client-rm" className="input" value={relationshipManager} onChange={(event) => setRelationshipManager(event.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={submitting} type="submit">
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {submitting ? "Saving" : editingId ? "Save client" : "Create user"}
            </button>
          </div>
        </form>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Client list</div>
            <button className="btn btn-secondary h-8" onClick={() => void load()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
          {clients.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Manager</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td className="font-medium text-slate-900">{client.name}</td>
                      <td>{client.email}</td>
                      <td>{titleCase(client.role)}</td>
                      <td>
                        <UserStatusBadge status={client.status} />
                      </td>
                      <td>{client.relationshipManager ?? "-"}</td>
                      <td>{formatDate(client.createdAt)}</td>
                      <td>
                        {client.status === "active" ? (
                          <div className="flex items-center gap-3">
                            <button className="text-[11px] font-medium text-navy-700 hover:underline" onClick={() => editClient(client)}>
                              Edit
                            </button>
                            <button className="text-[11px] font-medium text-slate-700 hover:underline" onClick={() => void updateStatus(client, "suspended")}>
                              Suspend
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button className="text-[11px] font-medium text-navy-700 hover:underline" onClick={() => editClient(client)}>
                              Edit
                            </button>
                            <button className="text-[11px] font-medium text-navy-700 hover:underline" onClick={() => void updateStatus(client, "active")}>
                              Activate
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No clients found" />
          )}
        </div>
      </section>
    </div>
  );
}
