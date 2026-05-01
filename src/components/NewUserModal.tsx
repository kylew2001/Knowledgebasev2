"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { createUser } from "@/app/auth/actions";

type Props = {
  onClose: () => void;
  onCreated: () => void;
};

export default function NewUserModal({ onClose, onCreated }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"super_admin" | "editor" | "viewer">("editor");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createUser({
        email,
        username: username.toLowerCase(),
        display_name: displayName || undefined,
        role
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onCreated();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg border border-line bg-white shadow-soft">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-bold text-ink">Create new user</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Display name</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Smith"
              className="focus-ring mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Username <span className="text-red-500">*</span>
            </span>
            <input
              required
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="jsmith"
              className="focus-ring mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Email <span className="text-red-500">*</span>
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="focus-ring mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "super_admin" | "editor" | "viewer")}
              className="focus-ring mt-2 h-10 w-full rounded-lg border border-line px-3 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <p className="text-xs text-slate-500">
            An invite email will be sent to the user with their username and login instructions.
          </p>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="focus-ring h-9 rounded-lg border border-line px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="focus-ring h-9 rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {isPending ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
