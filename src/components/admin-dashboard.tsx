"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  Database,
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  ShieldCheck,
  UserPlus,
  Users
} from "lucide-react";
import {
  type AdminUser,
  type SecuritySettings,
  type AuditLog,
  type StorageStats,
  updateUser,
  updateUserRole,
  toggleUserDisabled,
  sendPasswordReset,
  saveSecuritySettings
} from "@/app/(app)/admin/actions";
import EditUserModal from "@/components/EditUserModal";
import NewUserModal from "@/components/NewUserModal";

type Props = {
  users: AdminUser[];
  securitySettings: SecuritySettings;
  auditLogs: AuditLog[];
  auditTotal: number;
  storageStats: StorageStats;
};

function formatBytes(b: number) {
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + " GB";
  if (b >= 1048576) return (b / 1048576).toFixed(1) + " MB";
  if (b >= 1024) return (b / 1024).toFixed(1) + " KB";
  return b + " B";
}

function fmtAction(a: string) {
  return a.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminDashboard({
  users: initialUsers,
  securitySettings,
  auditLogs,
  auditTotal,
  storageStats
}: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);

  // Role select state
  const [userRoles, setUserRoles] = useState<Record<string, string>>(
    () => Object.fromEntries(initialUsers.map((u) => [u.id, u.role]))
  );
  const [rolePending, startRoleTransition] = useTransition();
  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null);

  // Lock/unlock state
  const [localDisabled, setLocalDisabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(initialUsers.map((u) => [u.id, !!u.disabled_at]))
  );
  const [, startDisableTransition] = useTransition();

  // Password reset state
  const [resetSent, setResetSent] = useState<Record<string, boolean>>({});
  const [, startResetTransition] = useTransition();

  // Security settings form state
  const [secForm, setSecForm] = useState<SecuritySettings>(securitySettings);
  const [secPending, startSecTransition] = useTransition();
  const [secSaved, setSecSaved] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);

  function handleSaved(userId: string, updated: Partial<AdminUser>) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
  }

  function handleRoleChange(userId: string, role: string) {
    setUserRoles((prev) => ({ ...prev, [userId]: role }));
    setPendingRoleUserId(userId);
    startRoleTransition(async () => {
      await updateUserRole(userId, role);
      setPendingRoleUserId(null);
    });
  }

  function handleToggleDisabled(userId: string) {
    const disable = !localDisabled[userId];
    setLocalDisabled((prev) => ({ ...prev, [userId]: disable }));
    startDisableTransition(async () => {
      const result = await toggleUserDisabled(userId, disable);
      if (result?.error) {
        // revert on error
        setLocalDisabled((prev) => ({ ...prev, [userId]: !disable }));
      }
    });
  }

  function handlePasswordReset(userId: string) {
    startResetTransition(async () => {
      await sendPasswordReset(userId);
      setResetSent((prev) => ({ ...prev, [userId]: true }));
      setTimeout(() => setResetSent((prev) => ({ ...prev, [userId]: false })), 2000);
    });
  }

  function handleSaveSecuritySettings() {
    setSecError(null);
    startSecTransition(async () => {
      const result = await saveSecuritySettings(secForm);
      if (result?.error) {
        setSecError(result.error);
        return;
      }
      setSecSaved(true);
      setTimeout(() => setSecSaved(false), 2000);
    });
  }

  const lockedCount = Object.values(localDisabled).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Super Admin</p>
        <h2 className="mt-1 text-3xl font-bold tracking-normal text-ink">Admin dashboard</h2>
      </header>

      {/* Stats */}
      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Users", value: String(users.length), icon: Users },
          { label: "Locked Accounts", value: String(lockedCount), icon: Lock },
          { label: "Audit Events", value: String(auditTotal), icon: Activity },
          {
            label: "Storage Used",
            value: `${formatBytes(storageStats.used_bytes)} / ${formatBytes(storageStats.total_bytes)}`,
            icon: Database
          }
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg border border-line bg-white p-4">
              <Icon className="h-5 w-5 text-brand" />
              <p className="mt-4 text-2xl font-bold text-ink">{stat.value}</p>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        {/* Users table */}
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-ink">Users and permissions</h3>
            <button onClick={() => setShowNewUser(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
              <UserPlus className="h-4 w-4" />
              New User
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="border-b border-line px-3 py-2">User</th>
                  <th className="border-b border-line px-3 py-2">Role</th>
                  <th className="border-b border-line px-3 py-2">Status</th>
                  <th className="border-b border-line px-3 py-2">Last login</th>
                  <th className="border-b border-line px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isDisabled = localDisabled[user.id] ?? false;
                  return (
                    <tr key={user.id}>
                      <td className="border-b border-line px-3 py-3">
                        <p className="font-semibold text-ink">{user.display_name || user.username || "—"}</p>
                        <p className="text-slate-500">{user.email}</p>
                        {user.username && <p className="text-xs text-slate-400">@{user.username}</p>}
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <select
                          value={userRoles[user.id] ?? user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="focus-ring rounded-lg border border-line bg-white px-3 py-2"
                          style={{
                            opacity: rolePending && pendingRoleUserId === user.id ? 0.5 : 1
                          }}
                        >
                          <option value="super_admin">super_admin</option>
                          <option value="editor">editor</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${
                            isDisabled ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-800"
                          }`}
                        >
                          {isDisabled ? "Disabled" : "Active"}
                        </span>
                      </td>
                      <td className="border-b border-line px-3 py-3 text-slate-600">
                        {user.last_login_at
                          ? new Date(user.last_login_at).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            title="Edit user"
                            onClick={() => setEditingUser(user)}
                            className="focus-ring rounded-lg border border-line p-2 hover:bg-panel"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            title="Send password reset"
                            onClick={() => handlePasswordReset(user.id)}
                            className="focus-ring rounded-lg border border-line p-2 hover:bg-panel"
                          >
                            {resetSent[user.id] ? (
                              <span className="text-xs font-semibold text-teal-700">Sent!</span>
                            ) : (
                              <KeyRound className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            title={isDisabled ? "Enable user" : "Disable user"}
                            onClick={() => handleToggleDisabled(user.id)}
                            className="focus-ring rounded-lg border border-line p-2 hover:bg-panel"
                          >
                            {isDisabled ? (
                              <LockOpen className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security controls */}
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="text-lg font-bold text-ink">Security controls</h3>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Failed login threshold</span>
              <input
                type="number"
                value={secForm.failed_login_threshold}
                onChange={(e) =>
                  setSecForm((prev) => ({ ...prev, failed_login_threshold: Number(e.target.value) }))
                }
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Lockout duration minutes</span>
              <input
                type="number"
                value={secForm.lockout_minutes}
                onChange={(e) =>
                  setSecForm((prev) => ({ ...prev, lockout_minutes: Number(e.target.value) }))
                }
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Inactivity timeout minutes</span>
              <input
                type="number"
                value={secForm.inactivity_timeout_minutes}
                onChange={(e) =>
                  setSecForm((prev) => ({ ...prev, inactivity_timeout_minutes: Number(e.target.value) }))
                }
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
              />
            </label>
          </div>
          {secError && <p className="mt-3 text-sm text-red-600">{secError}</p>}
          <button
            onClick={handleSaveSecuritySettings}
            disabled={secPending}
            className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            {secSaved ? "Saved!" : secPending ? "Saving…" : "Save Security Settings"}
          </button>
        </div>
      </section>

      {/* Audit logs */}
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">Audit logs</h3>
          <button className="focus-ring rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
            Export CSV
          </button>
        </div>
        <div className="divide-y divide-line">
          {auditLogs.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">No audit events yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="grid gap-2 py-3 md:grid-cols-[160px_1fr_180px]"
              >
                <p className="font-semibold text-ink">{fmtAction(log.action)}</p>
                <p className="text-sm text-slate-600">
                  <span className="font-medium">{log.actor_name ?? "System"}</span>
                  {log.target_label ? ` — ${log.target_label}` : ""}
                </p>
                <p className="text-sm text-slate-500 md:text-right">
                  {new Date(log.created_at).toLocaleString("en-NZ", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  })}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {showNewUser && (
        <NewUserModal
          onClose={() => setShowNewUser(false)}
          onCreated={() => window.location.reload()}
        />
      )}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            handleSaved(editingUser.id, updated);
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}
