"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type LookupRow = { user_id: string; email: string; force_password_change: boolean };

async function lookupByUsername(username: string): Promise<LookupRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("lookup_user_by_username", { p_username: username.toLowerCase().trim() })
    .maybeSingle();
  if (error) console.error("[lookupByUsername]", error.message, error.code);
  return (data as LookupRow) ?? null;
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
): Promise<{ error: string; lockoutMinutes?: number } | null> {
  const row = await lookupByUsername(username);
  if (!row) return { error: "invalid-credentials" };

  const admin = createAdminClient();

  const [{ data: profile }, { data: settings }] = await Promise.all([
    admin
      .from("profiles")
      .select("failed_login_count, locked_until, disabled_at")
      .eq("id", row.user_id)
      .single(),
    admin
      .from("security_settings")
      .select("failed_login_threshold, lockout_minutes")
      .single(),
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

  redirect("/knowledge-base");
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
