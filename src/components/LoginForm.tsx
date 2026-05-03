"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ArrowLeft, Eye, EyeOff } from "lucide-react";
import {
  checkUsername,
  completeMfaVerification,
  requestForgotPasswordReset,
  signInWithUsername,
  setInitialPassword,
  verifyEmailOtp,
  resendEmailOtp
} from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

type Step = "username" | "password" | "set-password" | "totp" | "email-otp" | "forgot-password";

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
  const router = useRouter();
  const usernameFormRef = useRef<HTMLFormElement>(null);
  const passwordFormRef = useRef<HTMLFormElement>(null);
  const forgotPasswordFormRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<Step>("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // MFA state
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const normalizedUsername = username.trim().toLowerCase();

  // Countdown timer for email OTP resend
  useEffect(() => {
    if (step !== "email-otp") return;
    setResendCountdown(60);
  }, [step]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const id = setInterval(() => {
      setResendCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [resendCountdown]);

  function goBack() {
    setStep("username");
    setPassword("");
    setConfirm("");
    setError(null);
    setTotpCode("");
    setOtpCode("");
    setMfaFactorId(null);
    setUserId(null);
    setForgotSubmitted(false);
  }

  function handleUsernameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizedUsername) return;
    setError(null);
    startTransition(async () => {
      const result = await checkUsername(normalizedUsername);
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
      const result = await signInWithUsername(normalizedUsername, password);
      if (!result) return; // redirected

      if ("mfaRequired" in result) {
        setUserId(result.userId);
        if (result.mfaRequired === "totp") {
          setMfaFactorId(result.factorId);
          setStep("totp");
        } else {
          setStep("email-otp");
        }
        return;
      }

      if (result.error) {
        setError(parseSignInError(result));
      }
    });
  }

  function handleForgotPasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!normalizedUsername || isPending) return;
    setError(null);
    setForgotSubmitted(false);
    startTransition(async () => {
      const result = await requestForgotPasswordReset(normalizedUsername);
      if (result.error) {
        setError(result.error);
        return;
      }
      setForgotSubmitted(true);
    });
  }

  function handleSetPasswordSubmit(e: React.FormEvent) {
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
      const result = await setInitialPassword(normalizedUsername, password);
      if (result?.error) setError("Failed to set password. Please try again.");
    });
  }

  function verifyTotpCode(code: string) {
    if (!mfaFactorId) return;
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId
      });
      if (challengeError || !challengeData) {
        setError("Failed to initiate MFA challenge. Please try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challengeData.id,
        code
      });
      if (verifyError) {
        setError("Invalid code. Please try again.");
        return;
      }
      await completeMfaVerification();
      router.push("/knowledge-base");
    });
  }

  function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (totpCode.length !== 6 || isPending) return;
    verifyTotpCode(totpCode);
  }

  function verifyEmailOtpCode(code: string) {
    if (!userId) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyEmailOtp(userId, code);
      if (!result) return; // redirected
      if (result.error) {
        setError("Invalid or expired code. Please try again.");
      }
    });
  }

  function handleEmailOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otpCode.length !== 6 || isPending) return;
    verifyEmailOtpCode(otpCode);
  }

  function handleResend() {
    setError(null);
    startTransition(async () => {
      const result = await resendEmailOtp(normalizedUsername);
      if (result?.error) {
        setError("Failed to resend code. Please try again.");
        return;
      }
      setResendCountdown(60);
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
        <form ref={usernameFormRef} onSubmit={handleUsernameSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Username</span>
            <input
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending) {
                  e.preventDefault();
                  usernameFormRef.current?.requestSubmit();
                }
              }}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Checking…" : "Next"}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setForgotSubmitted(false);
              setStep("forgot-password");
            }}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            Forgot password?
          </button>
        </form>
      )}

      {step === "password" && (
        <form ref={passwordFormRef} onSubmit={handlePasswordSubmit} className="space-y-4">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isPending) {
                    e.preventDefault();
                    passwordFormRef.current?.requestSubmit();
                  }
                }}
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
            <p
              className={`text-sm ${
                error.includes("locked") || error.includes("disabled")
                  ? "text-amber-700"
                  : "text-red-600"
              }`}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setForgotSubmitted(false);
              setStep("forgot-password");
            }}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700"
          >
            Forgot password?
          </button>
        </form>
      )}

      {step === "forgot-password" && (
        <form ref={forgotPasswordFormRef} onSubmit={handleForgotPasswordSubmit} className="space-y-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to sign in</span>
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-700">Forgot password</p>
            <p className="mt-1 text-sm text-slate-500">
              Enter your username and an admin will review the reset request.
            </p>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Username</span>
            <input
              autoFocus
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending) {
                  e.preventDefault();
                  forgotPasswordFormRef.current?.requestSubmit();
                }
              }}
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {forgotSubmitted && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Request sent. If the username exists, an admin can approve the reset from the admin dashboard.
            </p>
          )}
          <button
            type="submit"
            disabled={isPending || !normalizedUsername}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Sending request…" : "Request password reset"}
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
          <p className="text-sm text-slate-600">Welcome! Please set a strong password to continue.</p>
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
                  className={`flex items-center gap-2 text-xs ${
                    rule.test(password) ? "text-green-600" : "text-slate-400"
                  }`}
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
            type="submit"
            disabled={isPending || !isStrong(password) || password !== confirm}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Setting password…" : "Set password & sign in"}
          </button>
        </form>
      )}

      {step === "totp" && (
        <form onSubmit={handleTotpSubmit} className="space-y-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-700">Two-factor authentication</p>
            <p className="mt-1 text-sm text-slate-500">
              Enter the 6-digit code from your authenticator app.
            </p>
          </div>
          <label className="block">
            <span className="sr-only">Authenticator code</span>
            <input
              autoFocus
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totpCode}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                setTotpCode(next);
                if (next.length === 6 && !isPending) verifyTotpCode(next);
              }}
              placeholder="000000"
              className="focus-ring mt-1 h-14 w-full rounded-lg border border-line px-3 text-center text-2xl tracking-widest"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={isPending || totpCode.length !== 6}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Verifying…" : "Verify"}
          </button>
        </form>
      )}

      {step === "email-otp" && (
        <form onSubmit={handleEmailOtpSubmit} className="space-y-4">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-700">Check your email</p>
            <p className="mt-1 text-sm text-slate-500">
              A 6-digit code was sent to your email. It expires in 10 minutes.
            </p>
          </div>
          <label className="block">
            <span className="sr-only">Email code</span>
            <input
              autoFocus
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtpCode(next);
                if (next.length === 6 && !isPending) verifyEmailOtpCode(next);
              }}
              placeholder="000000"
              className="focus-ring mt-1 h-14 w-full rounded-lg border border-line px-3 text-center text-2xl tracking-widest"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={isPending || otpCode.length !== 6}
            className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {isPending ? "Verifying…" : "Verify"}
          </button>
          <button
            type="button"
            disabled={isPending || resendCountdown > 0}
            onClick={handleResend}
            className="w-full text-center text-sm text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Resend code"}
          </button>
        </form>
      )}
    </section>
  );
}
