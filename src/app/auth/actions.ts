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
): Promise<{ error: string } | null> {
  const row = await lookupByUsername(username);
  if (!row) return { error: "invalid-credentials" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: row.email, password });
  if (error) return { error: "invalid-credentials" };

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
  if (pwError) return { error: "update-failed" };

  await admin
    .from("profiles")
    .update({ force_password_change: false })
    .eq("id", row.user_id);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: row.email, password });
  if (error) return { error: "sign-in-failed" };

  redirect("/knowledge-base");
}
