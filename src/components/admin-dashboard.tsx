"use client";

import { useState, useTransition } from "react";
import {
  Activity,
  Building2,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  FolderTree,
  KeyRound,
  Lock,
  LockOpen,
  Mail,
  Pencil,
  Plus,
  Share2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import {
  type AdminGroup,
  type AdminUser,
  type SecuritySettings,
  type AuditLog,
  type SharedPostLink,
  type StorageStats,
  createGroup,
  deleteGroup,
  updateUser,
  updateUserRole,
  toggleUserDisabled,
  sendPasswordReset,
  resendUserInvite,
  resetUserTwoFactor,
  sendAdminTestEmail,
  saveSecuritySettings,
  updateGroup,
  revokeSharedPostLink
} from "@/app/(app)/admin/actions";
import EditUserModal from "@/components/EditUserModal";
import NewUserModal from "@/components/NewUserModal";
import { getGroupPath } from "@/lib/visibility";

type Props = {
  users: AdminUser[];
  groups: AdminGroup[];
  securitySettings: SecuritySettings;
  auditLogs: AuditLog[];
  auditTotal: number;
  storageStats: StorageStats;
  sharedLinks: SharedPostLink[];
};

type GroupForm = {
  id: string | null;
  name: string;
  description: string;
  parent_id: string;
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

function getShareStatus(link: SharedPostLink) {
  if (link.revoked_at) return "Revoked";
  if (new Date(link.expires_at).getTime() <= Date.now()) return "Expired";
  return "Active";
}

export function AdminDashboard({
  users: initialUsers,
  groups: initialGroups,
  securitySettings,
  auditLogs,
  auditTotal,
  storageStats,
  sharedLinks: initialSharedLinks
}: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [groups, setGroups] = useState(initialGroups);
  const [sharedLinks, setSharedLinks] = useState(initialSharedLinks);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [showNewUser, setShowNewUser] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupForm>({
    id: null,
    name: "",
    description: "",
    parent_id: ""
  });
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSaved, setGroupSaved] = useState(false);
  const [groupPending, startGroupTransition] = useTransition();
  const [sharePendingId, setSharePendingId] = useState<string | null>(null);
  const [, startShareTransition] = useTransition();

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
  const [inviteSent, setInviteSent] = useState<Record<string, boolean>>({});
  const [inviteErrors, setInviteErrors] = useState<Record<string, string | null>>({});
  const [, startInviteTransition] = useTransition();
  const [twoFaResetSent, setTwoFaResetSent] = useState<Record<string, boolean>>({});
  const [, startTwoFaResetTransition] = useTransition();

  // Security settings form state
  const [secForm, setSecForm] = useState<SecuritySettings>(securitySettings);
  const [secPending, startSecTransition] = useTransition();
  const [secSaved, setSecSaved] = useState(false);
  const [secError, setSecError] = useState<string | null>(null);
  const [testEmailPending, startTestEmailTransition] = useTransition();
  const [testEmailStatus, setTestEmailStatus] = useState<"sent" | "error" | null>(null);
  const [testEmailError, setTestEmailError] = useState<string | null>(null);

  function handleSaved(userId: string, updated: Partial<AdminUser>) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updated } : u)));
  }

  function resetGroupForm() {
    setGroupForm({ id: null, name: "", description: "", parent_id: "" });
    setGroupError(null);
  }

  function openNewGroup(parentId = "") {
    setGroupForm({ id: null, name: "", description: "", parent_id: parentId });
    setGroupError(null);
    setGroupSaved(false);
    setShowGroupModal(true);
  }

  function startEditingGroup(group: AdminGroup) {
    setGroupForm({
      id: group.id,
      name: group.name,
      description: group.description ?? "",
      parent_id: group.parent_id ?? ""
    });
    setGroupError(null);
    setGroupSaved(false);
    setShowGroupModal(true);
  }

  function getGroupAndDescendantIds(groupId: string) {
    const ids = new Set([groupId]);
    let changed = true;

    while (changed) {
      changed = false;
      groups.forEach((group) => {
        if (group.parent_id && ids.has(group.parent_id) && !ids.has(group.id)) {
          ids.add(group.id);
          changed = true;
        }
      });
    }

    return ids;
  }

  function isInvalidParentOption(parentId: string) {
    if (!groupForm.id) return false;
    return getGroupAndDescendantIds(groupForm.id).has(parentId);
  }

  function handleSaveGroup() {
    setGroupError(null);
    setGroupSaved(false);
    startGroupTransition(async () => {
      const payload = {
        name: groupForm.name,
        description: groupForm.description,
        parent_id: groupForm.parent_id || null
      };
      const result = groupForm.id
        ? await updateGroup(groupForm.id, payload)
        : await createGroup(payload);

      if (result.error || !result.group) {
        setGroupError(result.error ?? "Group could not be saved.");
        return;
      }

      setGroups((prev) => {
        const exists = prev.some((group) => group.id === result.group!.id);
        return exists
          ? prev.map((group) => (group.id === result.group!.id ? result.group! : group))
          : [...prev, result.group!];
      });
      setGroupSaved(true);
      resetGroupForm();
      setShowGroupModal(false);
      setTimeout(() => setGroupSaved(false), 2000);
    });
  }

  function handleDeleteGroup(group: AdminGroup) {
    if (!window.confirm(`Delete ${group.name} and any subgroups?`)) return;

    setGroupError(null);
    startGroupTransition(async () => {
      const result = await deleteGroup(group.id);
      if (result.error) {
        setGroupError(result.error);
        return;
      }

      const deletedIds = getGroupAndDescendantIds(group.id);
      setGroups((prev) => prev.filter((item) => !deletedIds.has(item.id)));
      if (groupForm.id && deletedIds.has(groupForm.id)) resetGroupForm();
    });
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

  function handleResendInvite(userId: string) {
    setInviteErrors((prev) => ({ ...prev, [userId]: null }));
    startInviteTransition(async () => {
      const result = await resendUserInvite(userId);
      if (result?.error) {
        setInviteErrors((prev) => ({ ...prev, [userId]: result.error }));
        return;
      }
      setInviteSent((prev) => ({ ...prev, [userId]: true }));
      setTimeout(() => setInviteSent((prev) => ({ ...prev, [userId]: false })), 2000);
    });
  }

  function handleTwoFaReset(userId: string) {
    startTwoFaResetTransition(async () => {
      const result = await resetUserTwoFactor(userId);
      if (result?.error) return;
      setTwoFaResetSent((prev) => ({ ...prev, [userId]: true }));
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, has_totp: false, totp_setup_required: true }
            : user
        )
      );
      setTimeout(() => setTwoFaResetSent((prev) => ({ ...prev, [userId]: false })), 2000);
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

  function handleSendTestEmail() {
    setTestEmailStatus(null);
    setTestEmailError(null);
    startTestEmailTransition(async () => {
      const result = await sendAdminTestEmail();
      if (result?.error) {
        setTestEmailStatus("error");
        setTestEmailError(result.error);
        return;
      }
      setTestEmailStatus("sent");
      setTimeout(() => setTestEmailStatus(null), 3000);
    });
  }

  function handleRevokeShare(link: SharedPostLink) {
    if (!window.confirm(`Revoke the shared link for ${link.post_title}?`)) return;

    setSharePendingId(link.id);
    startShareTransition(async () => {
      const result = await revokeSharedPostLink(link.id);
      setSharePendingId(null);
      if (result?.error) return;
      setSharedLinks((prev) =>
        prev.map((item) =>
          item.id === link.id ? { ...item, revoked_at: new Date().toISOString() } : item
        )
      );
    });
  }

  const lockedCount = Object.values(localDisabled).filter(Boolean).length;
  const sortedGroups = [...groups].sort((a, b) => a.name.localeCompare(b.name));
  const rootGroups = sortedGroups.filter((group) => !group.parent_id);
  const childGroups = sortedGroups.filter((group) => group.parent_id);
  const parentOptions = sortedGroups.filter((group) => !isInvalidParentOption(group.id));

  function renderGroup(group: AdminGroup, depth = 0) {
    const children = childGroups.filter((child) => child.parent_id === group.id);
    const isRoot = depth === 0;

    return (
      <div key={group.id} className={isRoot ? "rounded-lg border border-line p-3" : "rounded-lg bg-panel p-3"}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isRoot ? "bg-teal-50 text-brand" : "bg-white text-slate-500"}`}>
              {isRoot ? <Building2 className="h-5 w-5" /> : <FolderTree className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <p className={isRoot ? "font-bold text-ink" : "font-semibold text-ink"}>{group.name}</p>
              {group.description && <p className="text-sm text-slate-500">{group.description}</p>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              title="Add subgroup"
              onClick={() => openNewGroup(group.id)}
              className={`focus-ring rounded-lg border border-line p-2 hover:bg-panel ${isRoot ? "" : "bg-white"}`}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={isRoot ? "Edit group" : "Edit subgroup"}
              onClick={() => startEditingGroup(group)}
              className={`focus-ring rounded-lg border border-line p-2 hover:bg-panel ${isRoot ? "" : "bg-white"}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              title={isRoot ? "Delete group" : "Delete subgroup"}
              onClick={() => handleDeleteGroup(group)}
              className={`focus-ring rounded-lg border border-line p-2 text-slate-600 hover:bg-red-50 hover:text-red-600 ${isRoot ? "" : "bg-white"}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {children.length > 0 && (
          <div className="mt-3 space-y-2 border-l border-line pl-4">
            {children.map((child) => renderGroup(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Super Admin</p>
        <h2 className="mt-1 text-3xl font-bold tracking-normal text-ink">Admin dashboard</h2>
      </header>

      {/* Stats */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Users", value: String(users.length), icon: Users },
          { label: "Groups", value: String(groups.length), icon: FolderTree },
          { label: "Locked Accounts", value: String(lockedCount), icon: Lock },
          { label: "Audit Events", value: String(auditTotal), icon: Activity },
          { label: "Storage Used", value: `${formatBytes(storageStats.used_bytes)} / ${formatBytes(storageStats.total_bytes)}`, icon: Database }
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
                        <p className="mt-1 text-xs text-slate-400">
                          2FA: {user.has_totp ? "Configured" : user.totp_setup_required ? "Setup required" : "Not configured"}
                        </p>
                        {user.group_ids.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Groups: {user.group_ids
                              .map((groupId) => groups.find((group) => group.id === groupId))
                              .filter((group): group is AdminGroup => Boolean(group))
                              .map((group) => getGroupPath(group, groups))
                              .join(", ")}
                          </p>
                        )}
                        {inviteErrors[user.id] && (
                          <p className="mt-1 text-xs text-red-600">{inviteErrors[user.id]}</p>
                        )}
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
                            title="Resend invite email"
                            onClick={() => handleResendInvite(user.id)}
                            className="focus-ring rounded-lg border border-line p-2 hover:bg-panel"
                          >
                            {inviteSent[user.id] ? (
                              <span className="text-xs font-semibold text-teal-700">Sent!</span>
                            ) : (
                              <Mail className="h-4 w-4" />
                            )}
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
                          <button
                            title="Reset 2FA"
                            onClick={() => handleTwoFaReset(user.id)}
                            className="focus-ring rounded-lg border border-line p-2 hover:bg-panel"
                          >
                            {twoFaResetSent[user.id] ? (
                              <span className="text-xs font-semibold text-teal-700">Reset!</span>
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
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

          <div className="mt-5 border-t border-line pt-5">
            <h4 className="text-sm font-bold text-ink">Email integration</h4>
            <p className="mt-1 text-sm text-slate-500">
              Send a Resend test email to kswalker2201@gmail.com.
            </p>
            {testEmailStatus === "error" && (
              <p className="mt-3 text-sm text-red-600">{testEmailError}</p>
            )}
            {testEmailStatus === "sent" && (
              <p className="mt-3 text-sm font-semibold text-teal-700">Test email sent.</p>
            )}
            <button
              onClick={handleSendTestEmail}
              disabled={testEmailPending}
              className="focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-panel disabled:opacity-50"
            >
              <Mail className="h-4 w-4" />
              {testEmailPending ? "Sending..." : "Send Test Email"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setShowGroups((open) => !open)}
            className="focus-ring flex min-w-0 items-center gap-3 rounded-lg text-left"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand">
              <FolderTree className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-lg font-bold text-ink">Groups and departments</span>
              <span className="block text-sm text-slate-500">
                {groups.length} group{groups.length !== 1 ? "s" : ""} configured
              </span>
            </span>
            {showGroups ? (
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
            )}
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openNewGroup()}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-panel"
            >
              <Plus className="h-4 w-4" />
              Department
            </button>
            <button
              type="button"
              onClick={() => openNewGroup(rootGroups[0]?.id ?? "")}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Group
            </button>
          </div>
        </div>

        {groupSaved && <p className="mt-3 text-sm font-semibold text-teal-700">Group saved.</p>}
        {groupError && !showGroupModal && <p className="mt-3 text-sm text-red-600">{groupError}</p>}

        {showGroups && (
          <div className="mt-4 border-t border-line pt-4">
            {rootGroups.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-slate-500">
                No departments or groups yet.
              </p>
            ) : (
              <div className="space-y-3">
                {rootGroups.map((group) => renderGroup(group))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-4">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-ink">Shared post links</h3>
            <p className="text-sm text-slate-500">View active, expired, and revoked post-only links.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800">
            <Share2 className="h-4 w-4" />
            {sharedLinks.filter((link) => getShareStatus(link) === "Active").length} active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="border-b border-line px-3 py-2">Post</th>
                <th className="border-b border-line px-3 py-2">Created by</th>
                <th className="border-b border-line px-3 py-2">Created</th>
                <th className="border-b border-line px-3 py-2">Expires</th>
                <th className="border-b border-line px-3 py-2">Status</th>
                <th className="border-b border-line px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sharedLinks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                    No shared links yet.
                  </td>
                </tr>
              ) : (
                sharedLinks.map((link) => {
                  const status = getShareStatus(link);
                  return (
                    <tr key={link.id}>
                      <td className="border-b border-line px-3 py-3">
                        <p className="font-semibold text-ink">{link.post_title}</p>
                        <p className="text-xs text-slate-500">{link.post_category} / {link.post_subcategory}</p>
                      </td>
                      <td className="border-b border-line px-3 py-3 text-slate-600">{link.created_by_name}</td>
                      <td className="border-b border-line px-3 py-3 text-slate-600">
                        {new Date(link.created_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="border-b border-line px-3 py-3 text-slate-600">
                        {new Date(link.expires_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <span className={`rounded-md px-2 py-1 text-xs font-bold ${
                          status === "Active"
                            ? "bg-teal-50 text-teal-800"
                            : status === "Expired"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-red-50 text-red-700"
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="border-b border-line px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span title="Raw share URLs are not stored after creation." className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-slate-300">
                            <ExternalLink className="h-4 w-4" />
                          </span>
                          <button
                            type="button"
                            disabled={status !== "Active" || sharePendingId === link.id}
                            onClick={() => handleRevokeShare(link)}
                            className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
                          >
                            {sharePendingId === link.id ? "Revoking..." : "Revoke"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
          groups={groups}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            handleSaved(editingUser.id, updated);
            setEditingUser(null);
          }}
        />
      )}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4">
          <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink">{groupForm.id ? "Edit group" : "New group"}</h3>
                <p className="text-sm text-slate-500">
                  Choose no parent for a department, or choose a parent to make a subgroup.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGroupModal(false);
                  resetGroupForm();
                }}
                className="focus-ring rounded-lg p-1 hover:bg-panel"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Name</span>
                <input
                  autoFocus
                  value={groupForm.name}
                  onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Parent group</span>
                <select
                  value={groupForm.parent_id}
                  onChange={(e) => setGroupForm((prev) => ({ ...prev, parent_id: e.target.value }))}
                  className="focus-ring mt-2 h-11 w-full rounded-lg border border-line bg-white px-3"
                >
                  <option value="">No parent group</option>
                  {parentOptions.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.parent_id ? "  - " : ""}{group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Description</span>
                <textarea
                  value={groupForm.description}
                  onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="focus-ring mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm"
                />
              </label>
            </div>

            {groupError && <p className="mt-3 text-sm text-red-600">{groupError}</p>}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowGroupModal(false);
                  resetGroupForm();
                }}
                className="focus-ring h-11 flex-1 rounded-lg border border-line text-sm font-semibold text-ink hover:bg-panel"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGroup}
                disabled={groupPending}
                className="focus-ring inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {groupPending ? "Saving..." : groupForm.id ? "Save Group" : "Add Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
