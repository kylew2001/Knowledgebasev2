"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, isSuperAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  role: string;
  disabled_at: string | null;
  last_login_at: string | null;
};

async function guardAdmin() {
  const current = await getCurrentProfile();
  if (!current || !isSuperAdmin(current.profile.role)) redirect("/knowledge-base");
}

export async function listUsers(): Promise<AdminUser[]> {
  await guardAdmin();
  const admin = createAdminClient();

  const [{ data: profiles }, { data: authData }] = await Promise.all([
    admin.from("profiles").select("id, display_name, username, role, disabled_at, last_login_at"),
    admin.auth.admin.listUsers({ perPage: 1000 })
  ]);

  if (!profiles) return [];
  const emailMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  return profiles.map((p) => ({ ...p, email: emailMap.get(p.id) ?? "" }));
}

export async function updateUser(
  userId: string,
  data: { display_name?: string; email?: string; username?: string }
): Promise<{ error: string } | null> {
  await guardAdmin();
  const admin = createAdminClient();

  if (data.email) {
    const { error } = await admin.auth.admin.updateUserById(userId, { email: data.email });
    if (error) return { error: error.message };
  }

  const profileUpdate: Record<string, string> = {};
  if (data.display_name !== undefined) profileUpdate.display_name = data.display_name;
  if (data.username !== undefined) profileUpdate.username = data.username.toLowerCase().trim();

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin.from("profiles").update(profileUpdate).eq("id", userId);
    if (error) return { error: error.message };
  }

  return null;
}
