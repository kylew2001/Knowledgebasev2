"use client";

import { useState, useEffect, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { completeTotpSetup } from "@/app/auth/actions";

type Step = "enroll" | "verify";

export function SetupTwoFactorForm() {
  const supabase = createClient();

  const [step, setStep] = useState<Step>("enroll");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Knowledge Base",
      issuer: "Knowledge Base"
    }).then(({ data, error }) => {
      if (error || !data) {
        setError("Failed to start authenticator setup. Please refresh and try again.");
        setEnrolling(false);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrolling(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
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
        code
      });
      if (verifyError) {
        setError("Invalid code. Please check the time on your device and try again.");
        return;
      }
      // Server action: clears totp_setup_required flag, sets mfa_at cookie, redirects
      await completeTotpSetup();
    });
  }

  return (
    <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-white">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-brand">Account setup</p>
          <h1 className="text-2xl font-bold text-ink">Set up two-factor authentication</h1>
        </div>
      </div>

      {step === "enroll" && (
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            For your security, you must set up an authenticator app before accessing the system.
            Use <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
          </p>

          {enrolling ? (
            <p className="text-sm text-slate-500">Loading QR code…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  1. Scan this QR code with your authenticator app:
                </p>
                <img
                  src={qrCode}
                  alt="TOTP QR code"
                  className="h-44 w-44 rounded-lg border border-line"
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Or enter this secret manually:
                </p>
                <code className="mt-1 block break-all rounded bg-slate-100 px-3 py-2 text-xs text-slate-700">
                  {secret}
                </code>
              </div>
              <button
                onClick={() => setStep("verify")}
                className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800"
              >
                Next — enter verification code
              </button>
            </>
          )}
        </div>
      )}

      {step === "verify" && (
        <form onSubmit={handleVerify} className="space-y-5">
          <p className="text-sm text-slate-600">
            2. Enter the 6-digit code from your authenticator app to confirm setup.
          </p>
          <label className="block">
            <span className="sr-only">Verification code</span>
            <input
              autoFocus
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="focus-ring h-14 w-full rounded-lg border border-line px-3 text-center text-2xl tracking-widest"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep("enroll"); setCode(""); setError(null); }}
              className="focus-ring h-11 rounded-lg border border-line px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isPending || code.length !== 6}
              className="focus-ring h-11 flex-1 rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {isPending ? "Verifying…" : "Confirm & finish setup"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
