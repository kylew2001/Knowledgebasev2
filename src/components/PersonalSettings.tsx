"use client";

import { useState, useTransition } from "react";
import { KeyRound, Mail, Save, ShieldCheck, UserRound } from "lucide-react";
import {
  changeOwnPassword,
  createAccountChangeRequest,
  updateOwnDisplayName,
  type OwnAccountChangeRequest
} from "@/app/(app)/settings/actions";

type Props = {
  displayName: string;
  email: string;
  requests: OwnAccountChangeRequest[];
};

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /\d/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) }
];

function isStrong(password: string) {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

function requestLabel(type: OwnAccountChangeRequest["request_type"]) {
  if (type === "email_change") return "Email change";
  if (type === "two_fa_reset") return "2FA reset";
  return "Password reset";
}

export default function PersonalSettings({ displayName, email, requests }: Props) {
  const [name, setName] = useState(displayName);
  const [newEmail, setNewEmail] = useState(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localRequests, setLocalRequests] = useState(requests);
  const [status, setStatus] = useState<Record<string, string | null>>({});
  const [isPending, startTransition] = useTransition();

  function setMessage(key: string, message: string | null) {
    setStatus((prev) => ({ ...prev, [key]: message }));
  }

  function handleDisplayName() {
    setMessage("display", null);
    startTransition(async () => {
      const result = await updateOwnDisplayName(name);
      setMessage("display", result.error ?? "Display name updated.");
    });
  }

  function handlePasswordChange() {
    setMessage("password", null);
    if (newPassword !== confirmPassword) {
      setMessage("password", "New passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await changeOwnPassword(currentPassword, newPassword);
      if (result.error) {
        setMessage("password", result.error);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("password", "Password changed.");
    });
  }

  function handleRequest(type: "email_change" | "two_fa_reset") {
    const proposedValue = type === "email_change" ? newEmail : "Reset two-factor authentication";
    setMessage(type, null);
    startTransition(async () => {
      const result = await createAccountChangeRequest(type, proposedValue);
      if (result.error) {
        setMessage(type, result.error);
        return;
      }
      setLocalRequests((prev) => [
        {
          id: crypto.randomUUID(),
          request_type: type,
          proposed_value: type === "email_change" ? newEmail : null,
          status: "pending",
          admin_reason: null,
          created_at: new Date().toISOString(),
          reviewed_at: null
        },
        ...prev
      ]);
      setMessage(type, "Request sent to admins.");
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Account</p>
        <h2 className="mt-1 text-3xl font-bold text-ink">Personal settings</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Update your profile details and request protected account changes.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <UserRound className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-bold text-ink">Display name</h3>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name shown in the app</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          {status.display && <p className="mt-3 text-sm text-slate-600">{status.display}</p>}
          <button
            type="button"
            onClick={handleDisplayName}
            disabled={isPending || !name.trim()}
            className="focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save name
          </button>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-bold text-ink">Email address</h3>
          </div>
          <p className="mb-3 text-sm text-slate-500">Current email: <span className="font-semibold text-ink">{email}</span></p>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Proposed email</span>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          {status.email_change && <p className="mt-3 text-sm text-slate-600">{status.email_change}</p>}
          <button
            type="button"
            onClick={() => handleRequest("email_change")}
            disabled={isPending || !newEmail.trim() || newEmail.trim().toLowerCase() === email.toLowerCase()}
            className="focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            Request email change
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-bold text-ink">Password</h3>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
              />
            </label>
            {newPassword && (
              <ul className="space-y-1">
                {PASSWORD_RULES.map((rule) => (
                  <li key={rule.label} className={`text-xs ${rule.test(newPassword) ? "text-green-600" : "text-slate-400"}`}>
                    {rule.test(newPassword) ? "OK" : "--"} {rule.label}
                  </li>
                ))}
              </ul>
            )}
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
              />
            </label>
          </div>
          {status.password && <p className="mt-3 text-sm text-slate-600">{status.password}</p>}
          <button
            type="button"
            onClick={handlePasswordChange}
            disabled={isPending || !currentPassword || !isStrong(newPassword) || newPassword !== confirmPassword}
            className="focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <KeyRound className="h-4 w-4" />
            Change password
          </button>
        </div>

        <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-brand" />
            <h3 className="text-lg font-bold text-ink">Two-factor authentication</h3>
          </div>
          <p className="text-sm leading-6 text-slate-600">
            2FA can only be reset by an admin. Send a reset request if you have changed phones or lost access to your authenticator app.
          </p>
          {status.two_fa_reset && <p className="mt-3 text-sm text-slate-600">{status.two_fa_reset}</p>}
          <button
            type="button"
            onClick={() => handleRequest("two_fa_reset")}
            disabled={isPending}
            className="focus-ring mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            Request 2FA reset
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h3 className="text-lg font-bold text-ink">Request history</h3>
        <div className="mt-4 divide-y divide-line">
          {localRequests.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">No account change requests yet.</p>
          ) : (
            localRequests.map((request) => (
              <div key={request.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_120px]">
                <div>
                  <p className="font-semibold text-ink">{requestLabel(request.request_type)}</p>
                  {request.proposed_value && <p className="text-sm text-slate-500">{request.proposed_value}</p>}
                  {request.admin_reason && <p className="mt-1 text-sm text-slate-600">Admin note: {request.admin_reason}</p>}
                </div>
                <span className={`h-fit rounded-md px-2 py-1 text-center text-xs font-bold ${
                  request.status === "approved"
                    ? "bg-teal-50 text-teal-800"
                    : request.status === "denied"
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-800"
                }`}>
                  {request.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
