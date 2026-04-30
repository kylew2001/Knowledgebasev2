"use client";

import { useState, useTransition } from "react";
import { LockKeyhole, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { checkUsername, signInWithUsername, setInitialPassword } from "@/app/auth/actions";

type Step = "username" | "password" | "set-password";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /\d/.test(p) },
  { label: "Special character", test: (p: string) => /[^A-Za-z0-9]/.test(p) }
];

function isStrong(p: string) {
  return PASSWORD_RULES.every((r) => r.test(p));
}

function parseSignInError(result: { error: string; lockoutMinutes?: number }): string {
  if (result.error === "account-disabled")
    return "Your account has been disabled. Please contact an administrator.";
  if (result.error === "account-locked") {
    const mins = result.lockoutMinutes ?? 0;
    return `Account locked after too many failed attempts. Try again in ${mins} minute${mins !== 1 ? "s" : ""}.`;
  }
  return "Incorrect password. Please try again.";
}

export default function LoginForm() {
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function goBack() {
    setStep("username");
    setPassword("");
    setConfirm("");
    setError(null);
  }

  function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await checkUsername(username.trim());
      if (!result.found) {
        setError("Username not found.");
        return;
      }
      setStep(result.requiresPasswordSet ? "set-password" : "password");
    });
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signInWithUsername(username.trim(), password);
      if (result?.error) setError(parseSignInError(result));
    });
  }

  function handleSetPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isStrong(password)) { setError("Password does not meet all requirements."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setError(null);
    startTransition(async () => {
      const result = await setInitialPassword(username.trim(), password);
      if (result?.error) setError("Failed to set password. Please try again.");
    });
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-white">
          <LockKeyhole className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-brand">Secure sign in</p>
          <h1 className="text-2xl font-bold text-ink">IT Support KB</h1>
        </div>
      </div>

      {step === "username" && (
        <form onSubmit={handleUsernameSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Username</span>
            <input
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={isPending}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Checking…" : "Next"}
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>
              Signing in as <strong>{username}</strong>
            </span>
          </button>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
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
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>
          {error && (
            <p className={`text-sm ${error.includes("locked") || error.includes("disabled") ? "text-amber-700" : "text-red-600"}`}>
              {error}
            </p>
          )}
          <button
            disabled={isPending}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      {step === "set-password" && (
        <form onSubmit={handleSetPasswordSubmit} className="space-y-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>
              Setting up <strong>{username}</strong>
            </span>
          </button>
          <p className="text-sm text-slate-600">
            Welcome! Please set a strong password to continue.
          </p>
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
                onClick={() => setShowPassword((v) => !v)}
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
                  className={`flex items-center gap-2 text-xs ${rule.test(password) ? "text-green-600" : "text-slate-400"}`}
                >
                  <span>{rule.test(password) ? "✓" : "○"}</span>
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
            disabled={isPending || !isStrong(password) || password !== confirm}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Setting password…" : "Set password & sign in"}
          </button>
        </form>
      )}
    </section>
  );
}
