"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function checkUsername(
  username: string
): Promise<{ found: boolean; requiresPasswordSet: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("force_password_change")
    .eq("username", username.toLowerCase().trim())
    .maybeSingle();

  if (error) {
    console.error("[checkUsername] query error:", error.message, error.code);
    return { found: false, requiresPasswordSet: false };
  }
  if (!data) return { found: false, requiresPasswordSet: false };
  return { found: true, requiresPasswordSet: data.force_password_change };
}

export async function signInWithUsername(
  username: string,
  password: string
): Promise<{ error: string } | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase().trim())
    .maybeSingle();

  if (!profile) return { error: "invalid-credentials" };

  const {
    data: { user }
  } = await admin.auth.admin.getUserById(profile.id);
  if (!user?.email) return { error: "invalid-credentials" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password
  });
  if (error) return { error: "invalid-credentials" };

  redirect("/knowledge-base");
}

export async function setInitialPassword(
  username: string,
  password: string
): Promise<{ error: string } | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, force_password_change")
    .eq("username", username.toLowerCase().trim())
    .maybeSingle();

  if (!profile?.force_password_change) return { error: "not-allowed" };

  const { error: pwError } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (pwError) return { error: "update-failed" };

  await admin
    .from("profiles")
    .update({ force_password_change: false })
    .eq("id", profile.id);

  const {
    data: { user }
  } = await admin.auth.admin.getUserById(profile.id);
  if (!user?.email) return { error: "invalid-credentials" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password
  });
  if (error) return { error: "sign-in-failed" };

  redirect("/knowledge-base");
}
