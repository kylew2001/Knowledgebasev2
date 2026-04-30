"use client";

import { useState } from "react";
import {
  Activity,
  Database,
  KeyRound,
  Lock,
  Pencil,
  RotateCcw,
  ShieldCheck,
  UserPlus,
  Users
} from "lucide-react";
import { auditEvents } from "@/lib/mock-data";
import { type AdminUser } from "@/app/(app)/admin/actions";
import EditUserModal from "@/components/EditUserModal";

type Props = { users: AdminUser[] };

export function AdminDashboard({ users: initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  function handleSaved(userId: string, updated: Partial<AdminUser>) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
  }

  const lockedCount = users.filter((u) => u.disabled_at).length;

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Super Admin</p>
        <h2 className="mt-1 text-3xl font-bold tracking-normal text-ink">Admin dashboard</h2>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "Users", value: String(users.length), icon: Users },
          { label: "Locked Accounts", value: String(lockedCount), icon: Lock },
          { label: "Audit Events", value: "128", icon: Activity },
          { label: "Storage Used", value: "214 MB", icon: Database }
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
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-ink">Users and permissions</h3>
            <button className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
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
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="border-b border-line px-3 py-3">
                      <p className="font-semibold text-ink">{user.display_name || user.username || "—"}</p>
                      <p className="text-slate-500">{user.email}</p>
                      {user.username && <p className="text-xs text-slate-400">@{user.username}</p>}
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <select className="focus-ring rounded-lg border border-line bg-white px-3 py-2">
                        <option>{user.role}</option>
                        <option>super_admin</option>
                        <option>editor</option>
                        <option>viewer</option>
                      </select>
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${user.disabled_at ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-800"}`}>
                        {user.disabled_at ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td className="border-b border-line px-3 py-3 text-slate-600">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : "Never"}
                    </td>
                    <td className="border-b border-line px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          title="Edit user"
                          onClick={() => setEditingUser(user)}
                          className="focus-ring rounded-lg border border-line p-2 hover:bg-panel"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button title="Send password reset" className="focus-ring rounded-lg border border-line p-2 hover:bg-panel">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button title="Unlock account" className="focus-ring rounded-lg border border-line p-2 hover:bg-panel">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button title="Disable user" className="focus-ring rounded-lg border border-line p-2 hover:bg-panel">
                          <Lock className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="text-lg font-bold text-ink">Security controls</h3>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Failed login threshold</span>
              <input type="number" defaultValue={5} className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Lockout duration minutes</span>
              <input type="number" defaultValue={15} className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Inactivity timeout minutes</span>
              <input type="number" defaultValue={30} className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3" />
            </label>
          </div>
          <button className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            <ShieldCheck className="h-4 w-4" />
            Save Security Settings
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">Audit logs</h3>
          <button className="focus-ring rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel">
            Export CSV
          </button>
        </div>
        <div className="divide-y divide-line">
          {auditEvents.map((item) => (
            <div key={`${item.event}-${item.time}`} className="grid gap-2 py-3 md:grid-cols-[160px_1fr_150px]">
              <p className="font-semibold text-ink">{item.event}</p>
              <p className="text-sm text-slate-600">
                <span className="font-medium">{item.actor}</span> - {item.target}
              </p>
              <p className="text-sm text-slate-500 md:text-right">{item.time}</p>
            </div>
          ))}
        </div>
      </section>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => { handleSaved(editingUser.id, updated); setEditingUser(null); }}
        />
      )}
    </div>
  );
}
