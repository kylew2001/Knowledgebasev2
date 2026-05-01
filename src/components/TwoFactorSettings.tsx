"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleEmailTwoFa } from "@/app/(app)/settings/actions";

type Props = {
  userId: string;
  email: string;
  hasTOTP: boolean;
  emailTwoFaEnabled: boolean;
};

export default function TwoFactorSettings({ userId: _userId, email, hasTOTP, emailTwoFaEnabled }: Props) {
  const supabase = createClient();

  // TOTP state
  const [totpEnabled, setTotpEnabled] = useState(hasTOTP);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollData, setEnrollData] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpPending, setTotpPending] = useState(false);

  // Remove TOTP state
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Email OTP state
  const [emailOtpEnabled, setEmailOtpEnabled] = useState(emailTwoFaEnabled);
  const [emailOtpPending, startEmailOtpTransition] = useTransition();
  const [emailOtpError, setEmailOtpError] = useState<string | null>(null);

  // --- TOTP setup ---
  async function handleSetupTOTP() {
    setTotpError(null);
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) {
      setTotpError(error?.message ?? "Failed to start enrollment.");
      setEnrolling(false);
      return;
    }
    setEnrollData({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret
    });
  }

  async function handleVerifyTOTP() {
    if (!enrollData) return;
    setTotpError(null);
    setTotpPending(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollData.factorId
      });
      if (challengeError || !challenge) {
        setTotpError("Failed to initiate challenge. Please try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.factorId,
        challengeId: challenge.id,
        code: verifyCode
      });
      if (verifyError) {
        setTotpError("Invalid code. Please try again.");
        return;
      }
      // Success — reload to refresh server props
      window.location.reload();
    } finally {
      setTotpPending(false);
    }
  }

  function handleCancelEnroll() {
    setEnrolling(false);
    setEnrollData(null);
    setVerifyCode("");
    setTotpError(null);
  }

  // --- TOTP removal ---
  async function handleRemoveTOTP() {
    setRemoveError(null);
    setRemovePending(true);
    try {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError || !factors) {
        setRemoveError("Failed to retrieve factors.");
        return;
      }
      const totp = factors.totp.find((f) => f.status === "verified");
      if (!totp) {
        setRemoveError("No verified TOTP factor found.");
        return;
      }
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
      if (unenrollError) {
        setRemoveError(unenrollError.message);
        return;
      }
      setTotpEnabled(false);
      setShowRemoveConfirm(false);
    } finally {
      setRemovePending(false);
    }
  }

  // --- Email OTP toggle ---
  function handleToggleEmailOtp() {
    const next = !emailOtpEnabled;
    setEmailOtpEnabled(next); // optimistic
    setEmailOtpError(null);
    startEmailOtpTransition(async () => {
      const result = await toggleEmailTwoFa(next);
      if (result?.error) {
        setEmailOtpEnabled(!next); // revert
        setEmailOtpError("Failed to update setting. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Authenticator App */}
      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">Authenticator App (TOTP)</h3>
            <p className="mt-1 text-sm text-slate-500">
              Use an authenticator app like Google Authenticator or Authy.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {totpEnabled ? (
              <span className="inline-flex items-center rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">
                Enabled
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                Not enabled
              </span>
            )}
            {totpEnabled ? (
              !showRemoveConfirm ? (
                <button
                  onClick={() => setShowRemoveConfirm(true)}
                  className="focus-ring h-8 rounded-lg border border-line px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Remove
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Are you sure?</span>
                  <button
                    disabled={removePending}
                    onClick={handleRemoveTOTP}
                    className="focus-ring h-8 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {removePending ? "Removing…" : "Confirm"}
                  </button>
                  <button
                    onClick={() => setShowRemoveConfirm(false)}
                    className="focus-ring h-8 rounded-lg border border-line px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              )
            ) : (
              !enrolling && (
                <button
                  onClick={handleSetupTOTP}
                  className="focus-ring h-8 rounded-lg bg-brand px-3 text-sm font-bold text-white hover:bg-teal-800"
                >
                  Set up
                </button>
              )
            )}
          </div>
        </div>

        {removeError && (
          <p className="mt-3 text-sm text-red-600">{removeError}</p>
        )}

        {/* Enrollment UI */}
        {enrolling && enrollData && (
          <div className="mt-5 space-y-4 border-t border-line pt-5">
            <p className="text-sm font-semibold text-slate-700">
              Scan this QR code with your authenticator app:
            </p>
            <img
              src={enrollData.qrCode}
              alt="TOTP QR code"
              className="h-40 w-40 rounded-lg border border-line"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Or enter this secret manually:
              </p>
              <code className="mt-1 block break-all rounded bg-slate-100 px-3 py-2 text-xs text-slate-700">
                {enrollData.secret}
              </code>
            </div>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Enter 6-digit verification code to confirm
              </span>
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3 text-center text-2xl tracking-widest"
              />
            </label>
            {totpError && <p className="text-sm text-red-600">{totpError}</p>}
            <div className="flex gap-3">
              <button
                disabled={totpPending || verifyCode.length !== 6}
                onClick={handleVerifyTOTP}
                className="focus-ring h-9 rounded-lg bg-brand px-4 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {totpPending ? "Verifying…" : "Verify & enable"}
              </button>
              <button
                onClick={handleCancelEnroll}
                className="focus-ring h-9 rounded-lg border border-line px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {enrolling && !enrollData && (
          <p className="mt-4 text-sm text-slate-500">Loading QR code…</p>
        )}

        {totpError && !enrolling && (
          <p className="mt-3 text-sm text-red-600">{totpError}</p>
        )}
      </div>

      {/* Divider */}
      <hr className="border-line" />

      {/* Section 2: Email OTP */}
      <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-ink">Email OTP</h3>
            <p className="mt-1 text-sm text-slate-500">
              Receive a one-time code at <span className="font-medium text-slate-700">{email}</span> when
              signing in.
            </p>
          </div>
          {/* iOS-style toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={emailOtpEnabled}
            disabled={emailOtpPending}
            onClick={handleToggleEmailOtp}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 ${
              emailOtpEnabled ? "bg-brand" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                emailOtpEnabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
        {emailOtpError && (
          <p className="mt-3 text-sm text-red-600">{emailOtpError}</p>
        )}
      </div>
    </div>
  );
}
