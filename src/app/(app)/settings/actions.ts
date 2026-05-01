"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";

export async function toggleEmailTwoFa(enabled: boolean): Promise<{ error: string } | null> {
  const current = await getCurrentProfile();
  if (!current) return { error: "not-authenticated" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ email_2fa_enabled: enabled })
    .eq("id", current.profile.id);

  if (error) return { error: error.message };
  return null;
}
