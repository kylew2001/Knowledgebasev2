"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, isSuperAdmin } from "@/lib/auth";
import { sendInviteEmail, sendOtpEmail } from "@/lib/email";
import { createMfaDeviceCookieValue, verifyMfaDeviceCookieValue } from "@/lib/mfa-device-cookie";

type LookupRow = { user_id: string; email: string; force_password_change: boolean };

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function lookupByUsername(username: string): Promise<LookupRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("lookup_user_by_username", { p_username: username.toLowerCase().trim() })
    .maybeSingle();
  if (error) console.error("[lookupByUsername]", error.message, error.code);
  return (data as LookupRow) ?? null;
}

async function guardAdmin() {
  const current = await getCurrentProfile();
  if (!current || !isSuperAdmin(current.profile.role)) redirect("/knowledge-base");
  return current;
}

async function writeAuditLog(
  admin: ReturnType<typeof createAdminClient>,
  actorId: string,
  action: string,
  targetLabel: string,
  targetTable?: string,
  targetId?: string
) {
  try {
    await admin.from("audit_logs").insert({
      actor_id: actorId,
      action,
      target_label: targetLabel,
      ...(targetTable ? { target_table: targetTable } : {}),
      ...(targetId ? { target_id: targetId } : {})
    });
  } catch {
    // swallow — audit failures must never break the primary action
  }
}

async function setMfaCookieForRole(role: string, userId: string): Promise<void> {
  const cookieStore = await cookies();
  // super_admin: 24-hour expiry. editor/viewer: 1 year (remember device).
  const maxAge = role === "super_admin" ? 60 * 60 * 24 : 60 * 60 * 24 * 365;
  cookieStore.set("mfa_at", await createMfaDeviceCookieValue(userId, role), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge
  });
}

async function hasRememberedMfaDevice(role: string, userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const remembered = await verifyMfaDeviceCookieValue(cookieStore.get("mfa_at")?.value, userId, role);

  if (!remembered) return false;
  if (role !== "super_admin") return true;

  return Date.now() - remembered.issuedAt <= 24 * 60 * 60 * 1000;
}

export async function completeMfaVerification(): Promise<void> {
  const current = await getCurrentProfile();
  if (!current) return;
  await setMfaCookieForRole(current.profile.role, current.profile.id);
}

export async function completeTotpSetup(): Promise<void> {
  const current = await getCurrentProfile();
  if (!current) return;

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ totp_setup_required: false })
    .eq("id", current.profile.id);

  await setMfaCookieForRole(current.profile.role, current.profile.id);
  redirect("/knowledge-base");
}

export async function checkUsername(
  username: string
): Promise<{ found: boolean; requiresPasswordSet: boolean }> {
  return { found: Boolean(username.trim()), requiresPasswordSet: false };
}

export async function requestForgotPasswordReset(username: string): Promise<{ error?: string }> {
  const normalizedUsername = username.toLowerCase().trim();
  if (!normalizedUsername) return { error: "Enter your username." };

  const row = await lookupByUsername(normalizedUsername);
  if (!row) {
    // Do not reveal whether a username exists from the forgot-password flow.
    return {};
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("account_change_requests")
    .select("id")
    .eq("request_type", "password_reset")
    .eq("status", "pending")
    .or(`user_id.eq.${row.user_id},username.eq.${normalizedUsername}`)
    .maybeSingle();

  if (existing) return {};

  const { error } = await admin.from("account_change_requests").insert({
    user_id: row.user_id,
    username: normalizedUsername,
    request_type: "password_reset",
    proposed_value: "Forgot password reset"
  });

  if (error) return { error: "Could not submit password reset request." };

  await writeAuditLog(admin, row.user_id, "account_change_requested", "Forgot password reset requested", "profiles", row.user_id);
  return {};
}

export async function signInWithUsername(
  username: string,
  password: string
): Promise<
  | { error: string; lockoutMinutes?: number }
  | { mfaRequired: "totp"; factorId: string; userId: string }
  | { mfaRequired: "email"; userId: string }
  | null
> {
  const row = await lookupByUsername(username);
  if (!row) return { error: "invalid-credentials" };

  const admin = createAdminClient();

  const [{ data: profile }, { data: settings }] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "failed_login_count, locked_until, disabled_at, role, totp_setup_required"
      )
      .eq("id", row.user_id)
      .single(),
    admin.from("security_settings").select("failed_login_threshold, lockout_minutes").single()
  ]);

  if (profile?.disabled_at) return { error: "account-disabled" };

  if (profile?.locked_until && new Date(profile.locked_until) > new Date()) {
    const remainingMs = new Date(profile.locked_until).getTime() - Date.now();
    return { error: "account-locked", lockoutMinutes: Math.ceil(remainingMs / 60000) };
  }

  const threshold = settings?.failed_login_threshold ?? 5;
  const lockoutMins = settings?.lockout_minutes ?? 15;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: row.email, password });

  if (error) {
    const newCount = (profile?.failed_login_count ?? 0) + 1;
    if (newCount >= threshold) {
      const lockUntil = new Date(Date.now() + lockoutMins * 60_000).toISOString();
      await admin
        .from("profiles")
        .update({ failed_login_count: 0, locked_until: lockUntil })
        .eq("id", row.user_id);
      return { error: "account-locked", lockoutMinutes: lockoutMins };
    }
    await admin
      .from("profiles")
      .update({ failed_login_count: newCount })
      .eq("id", row.user_id);
    return { error: "invalid-credentials" };
  }

  await admin
    .from("profiles")
    .update({ failed_login_count: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq("id", row.user_id);

  // Force 2FA re-setup (admin reset)
  if (profile?.totp_setup_required) {
    redirect("/auth/setup-2fa");
  }

  // Remember device: super_admin for 24 hours, editor/viewer for 1 year.
  const role = (profile?.role as string) ?? "viewer";
  if (await hasRememberedMfaDevice(role, row.user_id)) {
    redirect("/knowledge-base");
  }

  // Check for verified TOTP factors
  const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
  const factors = authUser?.user?.factors ?? [];
  const totpFactor = factors.find(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );

  if (totpFactor) {
    return { mfaRequired: "totp" as const, factorId: totpFactor.id, userId: row.user_id };
  }

  redirect("/knowledge-base");
}

export async function verifyEmailOtp(
  userId: string,
  code: string
): Promise<{ error: string } | null> {
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("otp_code, otp_expires_at, role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) return { error: "invalid-code" };
  if (!profile.otp_code || !profile.otp_expires_at) return { error: "invalid-code" };
  if (new Date(profile.otp_expires_at) < new Date()) return { error: "invalid-code" };
  if (profile.otp_code !== code.trim()) return { error: "invalid-code" };

  await admin
    .from("profiles")
    .update({ otp_code: null, otp_expires_at: null })
    .eq("id", userId);

  await setMfaCookieForRole((profile.role as string) ?? "viewer", userId);
  redirect("/knowledge-base");
}

export async function resendEmailOtp(
  username: string
): Promise<{ error: string } | null> {
  const row = await lookupByUsername(username);
  if (!row) return { error: "user-not-found" };

  const admin = createAdminClient();
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

  const { error } = await admin
    .from("profiles")
    .update({ otp_code: code, otp_expires_at: expiresAt })
    .eq("id", row.user_id);

  if (error) return { error: "update-failed" };

  await sendOtpEmail(row.email, code);
  return null;
}

export async function createUser(data: {
  email: string;
  username: string;
  display_name?: string;
  role: string;
}): Promise<{ error: string } | null> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const { data: authUser, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    email_confirm: true,
    password: crypto.randomUUID(),
    app_metadata: { role: data.role }
  });

  if (createError || !authUser?.user) {
    return { error: createError?.message ?? "Failed to create user" };
  }

  const userId = authUser.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      username: data.username.toLowerCase().trim(),
      display_name: data.display_name ?? null,
      role: data.role,
      force_password_change: true,
      totp_setup_required: true
    })
    .eq("id", userId);

  if (profileError) return { error: profileError.message };

  await writeAuditLog(
    admin,
    current.profile.id,
    "user_created",
    data.display_name ?? data.username,
    "profiles",
    userId
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
  const setupToken = randomBytes(32).toString("base64url");
  const setupUrl = `${appUrl.replace(/\/$/, "")}/reset-password/${setupToken}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: tokenError } = await admin.from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: hashResetToken(setupToken),
    reason: "initial_setup",
    created_by: current.profile.id,
    expires_at: expiresAt
  });

  if (tokenError) return { error: tokenError.message };

  try {
    await sendInviteEmail(data.email, data.username.toLowerCase().trim(), setupUrl);
  } catch (err) {
    return {
      error: `User was created, but the invite email failed: ${
        err instanceof Error ? err.message : "Unknown email error"
      }`
    };
  }

  return null;
}

export async function setInitialPassword(
  username: string,
  password: string
): Promise<{ error: string } | null> {
  return { error: "not-allowed" };
}

export async function setPasswordWithResetToken(
  token: string,
  password: string
): Promise<{ error: string } | null> {
  const admin = createAdminClient();
  const { data: resetToken, error: tokenError } = await admin
    .from("password_reset_tokens")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", hashResetToken(token))
    .maybeSingle();

  if (tokenError || !resetToken || resetToken.used_at) return { error: "invalid-token" };
  if (new Date(resetToken.expires_at as string).getTime() <= Date.now()) {
    return { error: "expired-token" };
  }

  const { data: authUser } = await admin.auth.admin.getUserById(resetToken.user_id as string);
  const email = authUser.user?.email;
  if (!email) return { error: "invalid-token" };

  const { error: pwError } = await admin.auth.admin.updateUserById(resetToken.user_id as string, { password });
  if (pwError) {
    console.error("[setPasswordWithResetToken] updateUserById:", pwError.message, pwError.status);
    return { error: "update-failed" };
  }

  const [{ error: profileError }, { error: consumeError }] = await Promise.all([
    admin
    .from("profiles")
    .update({ force_password_change: false, last_login_at: new Date().toISOString() })
      .eq("id", resetToken.user_id as string),
    admin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetToken.id as string)
  ]);

  if (profileError || consumeError) return { error: "update-failed" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "sign-in-failed" };

  redirect("/auth/setup-2fa");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete("mfa_at");
  redirect("/login");
}
