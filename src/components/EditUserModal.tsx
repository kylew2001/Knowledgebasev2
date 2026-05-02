"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { updateUser, type AdminGroup, type AdminUser } from "@/app/(app)/admin/actions";
import { getGroupPath } from "@/lib/visibility";

type Props = {
  user: AdminUser;
  groups: AdminGroup[];
  onClose: () => void;
  onSaved: (updated: Partial<AdminUser>) => void;
};

export default function EditUserModal({ user, groups, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [email, setEmail] = useState(user.email);
  const [groupIds, setGroupIds] = useState(user.group_ids);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateUser(user.id, { display_name: displayName, username, email, group_ids: groupIds });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onSaved({ display_name: displayName, username, email, group_ids: groupIds });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-4">
      <div className="my-3 max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-white p-4 shadow-soft sm:my-4 sm:max-h-[calc(100dvh-2rem)] sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Edit user</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-panel">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Display name</span>
            <input
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Username</span>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          <div>
            <span className="text-sm font-semibold text-slate-700">Departments / groups</span>
            <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded-lg border border-line p-3">
              {groups.length === 0 ? (
                <p className="text-sm text-slate-500">No groups configured.</p>
              ) : (
                groups.map((group) => (
                  <label key={group.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(group.id)}
                      onChange={(e) =>
                        setGroupIds((prev) =>
                          e.target.checked
                            ? [...prev, group.id]
                            : prev.filter((id) => id !== group.id)
                        )
                      }
                      className="h-4 w-4 rounded border-line"
                    />
                    {getGroupPath(group, groups)}
                  </label>
                ))
              )}
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring h-11 flex-1 rounded-lg border border-line text-sm font-semibold text-ink hover:bg-panel"
            >
              Cancel
            </button>
            <button
              disabled={isPending}
              className="focus-ring h-11 flex-1 rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
