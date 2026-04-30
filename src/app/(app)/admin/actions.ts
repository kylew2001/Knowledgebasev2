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

export type SecuritySettings = {
  failed_login_threshold: number;
  lockout_minutes: number;
  inactivity_timeout_minutes: number;
};

export type AuditLog = {
  id: string;
  action: string;
  actor_name: string | null;
  target_label: string | null;
  created_at: string;
};

export type StorageStats = {
  used_bytes: number;
  total_bytes: number;
};

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

export async function updateUserRole(userId: string, role: string): Promise<{ error: string } | null> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .single();

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  const displayName = profile?.display_name ?? profile?.username ?? userId;
  await writeAuditLog(
    admin,
    current.profile.id,
    "role_changed",
    `${displayName} → ${role}`,
    "profiles",
    userId
  );

  return null;
}

export async function toggleUserDisabled(userId: string, disable: boolean): Promise<{ error: string } | null> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .single();

  const { error } = await admin
    .from("profiles")
    .update({ disabled_at: disable ? new Date().toISOString() : null })
    .eq("id", userId);

  if (error) return { error: error.message };

  const displayName = profile?.display_name ?? profile?.username ?? userId;
  const action = disable ? "user_disabled" : "user_enabled";
  await writeAuditLog(admin, current.profile.id, action, displayName, "profiles", userId);

  return null;
}

export async function sendPasswordReset(userId: string): Promise<{ error: string } | null> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .single();

  const { error } = await admin
    .from("profiles")
    .update({ force_password_change: true })
    .eq("id", userId);

  if (error) return { error: error.message };

  const displayName = profile?.display_name ?? profile?.username ?? userId;
  await writeAuditLog(admin, current.profile.id, "password_reset", displayName, "profiles", userId);

  return null;
}

export async function getSecuritySettings(): Promise<SecuritySettings> {
  await guardAdmin();
  const admin = createAdminClient();

  const { data } = await admin.from("security_settings").select("*").single();

  return (
    data ?? {
      failed_login_threshold: 5,
      lockout_minutes: 15,
      inactivity_timeout_minutes: 30
    }
  );
}

export async function saveSecuritySettings(settings: SecuritySettings): Promise<{ error: string } | null> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("security_settings")
    .update(settings)
    .eq("id", true);

  if (error) return { error: error.message };

  await writeAuditLog(admin, current.profile.id, "settings_updated", "Security settings");

  return null;
}

export async function getAuditLogs(limit = 50): Promise<{ logs: AuditLog[]; total: number }> {
  await guardAdmin();
  const admin = createAdminClient();

  const { data, count, error } = await admin
    .from("audit_logs")
    .select("id, action, target_label, created_at, profiles(display_name, username)", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return { logs: [], total: 0 };

  const logs: AuditLog[] = data.map((row) => {
    const p = (row as unknown as { profiles: { display_name: string | null; username: string | null } | null }).profiles;
    const actor_name = p?.display_name ?? p?.username ?? "System";
    return {
      id: row.id as string,
      action: row.action as string,
      actor_name,
      target_label: row.target_label as string | null,
      created_at: row.created_at as string
    };
  });

  return { logs, total: count ?? 0 };
}

export async function getStorageStats(): Promise<StorageStats> {
  await guardAdmin();
  const admin = createAdminClient();

  const { data } = await admin.from("article_files").select("file_size_bytes");

  const used_bytes = (data ?? []).reduce((sum, row) => sum + (row.file_size_bytes ?? 0), 0);

  return { used_bytes, total_bytes: 1073741824 };
}
