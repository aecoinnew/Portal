"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Shield, ShieldOff, UserPlus, KeyRound, Ban, CircleCheck, Lock } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ui/state";
import { apiRequest } from "@/lib/api/client";
import { useAuth } from "@/contexts/auth-context";
import { AssistantPanel } from "./assistant-panel";
import { ResetRequestsPanel } from "./reset-requests-panel";
import { formatDateTime } from "@/lib/utils/format";

type MasterUser = {
  id: string;
  name: string;
  email: string;
  role:
    | "super_admin" | "admin" | "operations" | "relationship_manager"
    | "compliance" | "finance" | "auditor" | "client";
  status: "active" | "suspended";
  phone: string | null;
  relationshipManager: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
};

const ALL_ROLES: MasterUser["role"][] = [
  "super_admin",
  "admin",
  "operations",
  "relationship_manager",
  "compliance",
  "finance",
  "auditor",
  "client"
];

export default function MasterAdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<MasterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [tempPasswordContext, setTempPasswordContext] = useState<string>("");

  // create form
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<MasterUser["role"]>("admin");

  // gate: only super_admin
  const isSuperAdmin = user?.role === "super_admin";

  async function load() {
    const data = await apiRequest<{ users: MasterUser[] }>("/admin/master/users");
    setUsers(data.users);
  }

  useEffect(() => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setTempPassword(null);
    try {
      const resp = await apiRequest<{
        user: { id: string; email: string; role: string };
        tempPassword: string;
        message: string;
      }>("/admin/master/users", {
        method: "POST",
        body: JSON.stringify({ name: createName, email: createEmail, role: createRole })
      });
      setTempPassword(resp.tempPassword);
      setTempPasswordContext(`new user ${resp.user.email}`);
      setCreateName("");
      setCreateEmail("");
      setCreateRole("admin");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function changeRole(target: MasterUser, role: MasterUser["role"]) {
    setError(null);
    try {
      await apiRequest(`/admin/master/users/${target.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role })
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Role change failed");
    }
  }

  async function changeStatus(target: MasterUser, status: MasterUser["status"]) {
    setError(null);
    try {
      await apiRequest(`/admin/master/users/${target.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status change failed");
    }
  }

  async function forceChange(target: MasterUser) {
    setError(null);
    try {
      await apiRequest(`/admin/master/users/${target.id}/force-password-change`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Force-change failed");
    }
  }

  async function resetMfa(target: MasterUser) {
    setError(null);
    if (!confirm(`Reset MFA for ${target.email}? They will need to re-enroll on next login.`)) return;
    try {
      await apiRequest(`/admin/master/users/${target.id}/mfa-reset`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "MFA reset failed");
    }
  }

  async function resetPassword(target: MasterUser) {
    setError(null);
    setTempPassword(null);
    if (!confirm(`Reset password for ${target.email}? A new temporary password will be generated.`)) return;
    try {
      const resp = await apiRequest<{ tempPassword: string; message: string }>(
        `/admin/master/users/${target.id}/reset-password`,
        { method: "POST" }
      );
      setTempPassword(resp.tempPassword);
      setTempPasswordContext(`reset for ${target.email}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
  }

  async function resetById(userId: string) {
    const target = users.find((u) => u.id === userId);
    if (!target) {
      setError("User not found in list. Refresh and try again.");
      return;
    }
    await resetPassword(target);
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="page-title">Master Admin</h1>
        <ErrorState message="This dashboard is restricted to super_admin users." />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading users" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-navy-700" />
        <div>
          <h1 className="page-title">Master Admin</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Governance for users and roles. All actions are audited.
          </p>
        </div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      {tempPassword ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <Lock className="h-4 w-4" />
            Temporary password generated for {tempPasswordContext}
          </div>
          <div className="mt-2 font-mono text-[14px]">
            <code className="rounded bg-amber-100 px-2 py-1">{tempPassword}</code>
          </div>
          <div className="mt-2 text-[12px] text-amber-800">
            Save this now. It will not be shown again. Communicate it via a secure channel.
            The user must change it on first login.
          </div>
          <button
            className="mt-2 rounded border border-amber-400 bg-white px-3 py-1 text-[12px] font-medium text-amber-900 hover:bg-amber-100"
            onClick={() => setTempPassword(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Create user */}
      <section className="card">
        <div className="card-header">
          <div className="card-title">Create user</div>
        </div>
        <form className="grid gap-4 p-5 lg:grid-cols-[1fr_1fr_180px_120px]" onSubmit={createUser}>
          <div>
            <label className="label">Name</label>
            <input className="input" value={createName} onChange={(e) => setCreateName(e.target.value)} required minLength={2} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Role</label>
            <select className="select" value={createRole} onChange={(e) => setCreateRole(e.target.value as MasterUser["role"])}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button className="btn btn-primary w-full" type="submit">
              <UserPlus className="h-4 w-4" /> Create
            </button>
          </div>
        </form>
      </section>

      {/* Users table */}
      <section className="card">
        <div className="card-header">
          <div className="card-title">Users ({users.length})</div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name / Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Flags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium text-slate-900">{u.name}</div>
                      <div className="text-[11px] text-slate-500">{u.email}</div>
                      {isSelf ? <div className="text-[11px] font-medium text-navy-700">(you)</div> : null}
                    </td>
                    <td>
                      <select
                        className="select h-8 text-[12px]"
                        value={u.role}
                        disabled={isSelf}
                        onChange={(e) => void changeRole(u, e.target.value as MasterUser["role"])}
                      >
                        {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      {u.status === "active" ? (
                        <span className="tag bg-green-100 text-green-800">active</span>
                      ) : (
                        <span className="tag bg-slate-200 text-slate-700">suspended</span>
                      )}
                    </td>
                    <td className="text-[12px]">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                    <td className="text-[12px]">{formatDateTime(u.createdAt)}</td>
                    <td className="text-[12px]">{formatDateTime(u.updatedAt)}</td>
                    <td className="text-[11px]">
                      {u.mustChangePassword ? (
                        <span className="tag bg-amber-100 text-amber-800">must change pwd</span>
                      ) : "—"}
                    </td>
                    <td className="space-x-1">
                      {u.status === "active" ? (
                        <button
                          className="text-[11px] font-medium text-slate-700 hover:underline"
                          disabled={isSelf}
                          onClick={() => void changeStatus(u, "suspended")}
                          title={isSelf ? "Cannot suspend yourself" : "Suspend"}
                        >
                          <Ban className="inline h-3.5 w-3.5 mr-1" />Suspend
                        </button>
                      ) : (
                        <button
                          className="text-[11px] font-medium text-navy-700 hover:underline"
                          onClick={() => void changeStatus(u, "active")}
                        >
                          <CircleCheck className="inline h-3.5 w-3.5 mr-1" />Activate
                        </button>
                      )}
                      <button
                        className="text-[11px] font-medium text-slate-700 hover:underline"
                        onClick={() => void forceChange(u)}
                      >
                        Force pwd change
                      </button>
                      <button
                        className="text-[11px] font-medium text-amber-700 hover:underline"
                        onClick={() => void resetPassword(u)}
                      >
                        <KeyRound className="inline h-3.5 w-3.5 mr-1" />Reset pwd
                      </button>
                      <button
                        className="text-[11px] font-medium text-rose-700 hover:underline"
                        disabled={isSelf}
                        title={isSelf ? "Use /admin/mfa-setup for your own account" : "Reset MFA (force re-enrollment on next login)"}
                        onClick={() => void resetMfa(u)}
                      >
                        <ShieldOff className="inline h-3.5 w-3.5 mr-1" />Reset MFA
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AssistantPanel />

      <ResetRequestsPanel onResetUser={(id) => void resetById(id)} />
    </div>
  );
}
