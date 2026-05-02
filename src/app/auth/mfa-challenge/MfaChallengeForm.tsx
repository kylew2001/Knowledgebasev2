"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { completeMfaVerification } from "@/app/auth/actions";

export function MfaChallengeForm({ factorId, next }: { factorId: string; next: string }) {
  const supabase = createClient();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function verifyCode(nextCode: string) {
    setError(null);
    startTransition(async () => {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });
      if (challengeError || !challenge) {
        setError("Failed to initiate challenge. Please try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: nextCode
      });
      if (verifyError) {
        setError("Invalid code. Please try again.");
        return;
      }
      await completeMfaVerification();
      router.push(next);
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6 || isPending) return;
    verifyCode(code);
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-white">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-brand">Security check</p>
          <h1 className="text-2xl font-bold text-ink">Verify your identity</h1>
        </div>
      </div>
      <p className="mb-5 text-sm text-slate-600">
        Your two-factor authentication needs to be re-verified. Enter the 6-digit code from your
        authenticator app.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="sr-only">Authenticator code</span>
          <input
            autoFocus
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const nextCode = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(nextCode);
              if (nextCode.length === 6 && !isPending) verifyCode(nextCode);
            }}
            placeholder="000000"
            className="focus-ring h-14 w-full rounded-lg border border-line px-3 text-center text-2xl tracking-widest"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isPending || code.length !== 6}
          className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {isPending ? "Verifying…" : "Verify"}
        </button>
      </form>
    </section>
  );
}
