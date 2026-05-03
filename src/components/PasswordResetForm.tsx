"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { setPasswordWithResetToken } from "@/app/auth/actions";

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

export function PasswordResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStrong(password)) {
      setError("Password does not meet all requirements.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await setPasswordWithResetToken(token, password);
      if (result?.error === "expired-token") {
        setError("This reset link has expired. Please request a new one.");
        return;
      }
      if (result?.error) setError("This reset link is invalid or has already been used.");
    });
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-white">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-brand">Secure password setup</p>
          <h1 className="text-2xl font-bold text-ink">Set your password</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">New password</span>
          <div className="relative mt-2">
            <input
              autoFocus
              required
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring h-11 w-full rounded-lg border border-line px-3 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>

        {password && (
          <ul className="space-y-1">
            {PASSWORD_RULES.map((rule) => (
              <li
                key={rule.label}
                className={`flex items-center gap-2 text-xs ${
                  rule.test(password) ? "text-green-600" : "text-slate-400"
                }`}
              >
                <span>{rule.test(password) ? "OK" : "--"}</span>
                {rule.label}
              </li>
            ))}
          </ul>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Confirm password</span>
          <input
            required
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isPending || !isStrong(password) || password !== confirm}
          className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {isPending ? "Setting password..." : "Set password and sign in"}
        </button>
      </form>
    </section>
  );
}
