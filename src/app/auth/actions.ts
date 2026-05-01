"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, isSuperAdmin } from "@/lib/auth";
import { sendInviteEmail, sendOtpEmail } from "@/lib/email";

type LookupRow = { user_id: string; email: string; force_password_change: boolean };

async function lookupByUsername(username: string): Promise<LookupRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
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

export async function checkUsername(
  username: string
): Promise<{ found: boolean; requiresPasswordSet: boolean }> {
  const row = await lookupByUsername(username);
  if (!row) return { found: false, requiresPasswordSet: false };
  return { found: true, requiresPasswordSet: row.force_password_change };
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
      .select("failed_login_count, locked_until, disabled_at, email_2fa_enabled")
      .eq("id", row.user_id)
      .single(),
    admin
      .from("security_settings")
      .select("failed_login_threshold, lockout_minutes")
      .single()
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

  // Check for verified TOTP factors
  const { data: authUser } = await admin.auth.admin.getUserById(row.user_id);
  const factors = authUser?.user?.factors ?? [];
  const totpFactor = factors.find(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );

  if (totpFactor) {
    return { mfaRequired: "totp" as const, factorId: totpFactor.id, userId: row.user_id };
  }

  if (profile?.email_2fa_enabled) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await admin
      .from("profiles")
      .update({ otp_code: code, otp_expires_at: expiresAt })
      .eq("id", row.user_id);
    await sendOtpEmail(row.email, code);
    return { mfaRequired: "email" as const, userId: row.user_id };
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
    .select("otp_code, otp_expires_at")
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
    password: crypto.randomUUID()
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
      force_password_change: true
    })
    .eq("id", userId);

  if (profileError) return { error: profileError.message };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
  await sendInviteEmail(data.email, data.username.toLowerCase().trim(), appUrl);

  await writeAuditLog(
    admin,
    current.profile.id,
    "user_created",
    data.display_name ?? data.username,
    "profiles",
    userId
  );

  return null;
}

export async function setInitialPassword(
  username: string,
  password: string
): Promise<{ error: string } | null> {
  const row = await lookupByUsername(username);
  if (!row?.force_password_change) return { error: "not-allowed" };

  const admin = createAdminClient();
  const { error: pwError } = await admin.auth.admin.updateUserById(row.user_id, { password });
  if (pwError) {
    console.error("[setInitialPassword] updateUserById:", pwError.message, pwError.status);
    return { error: "update-failed" };
  }

  await admin
    .from("profiles")
    .update({ force_password_change: false, last_login_at: new Date().toISOString() })
    .eq("id", row.user_id);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: row.email, password });
  if (error) return { error: "sign-in-failed" };

  redirect("/knowledge-base");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
