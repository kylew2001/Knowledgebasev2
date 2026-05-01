"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, isSuperAdmin } from "@/lib/auth";
import { sendInviteEmail, sendResendTestEmail } from "@/lib/email";
import { redirect } from "next/navigation";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  username: string | null;
  role: string;
  disabled_at: string | null;
  last_login_at: string | null;
  totp_setup_required: boolean;
  has_totp: boolean;
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

export type AdminGroup = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type MfaFactor = {
  id: string;
  factor_type?: string;
  status?: string;
};

type MfaFactorsResponse = {
  factors?: MfaFactor[];
  totp?: MfaFactor[];
  phone?: MfaFactor[];
} | null;

function normalizeMfaFactors(data: MfaFactorsResponse): MfaFactor[] {
  return [...(data?.factors ?? []), ...(data?.totp ?? []), ...(data?.phone ?? [])];
}

function hasVerifiedTotp(data: MfaFactorsResponse): boolean {
  return normalizeMfaFactors(data).some(
    (factor) => factor.factor_type === "totp" && factor.status === "verified"
  );
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

export async function listUsers(): Promise<AdminUser[]> {
  await guardAdmin();
  const admin = createAdminClient();

  const [{ data: profiles }, { data: authData }] = await Promise.all([
    admin.from("profiles").select("id, display_name, username, role, disabled_at, last_login_at, totp_setup_required"),
    admin.auth.admin.listUsers({ perPage: 1000 })
  ]);

  if (!profiles) return [];
  const emailMap = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const factorResults = await Promise.all(
    profiles.map(async (profile) => {
      const { data } = await admin.auth.admin.mfa.listFactors({
        userId: profile.id
      });
      return [profile.id, hasVerifiedTotp(data as MfaFactorsResponse)] as const;
    })
  );
  const totpMap = new Map(factorResults);

  return profiles.map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "",
    has_totp: totpMap.get(p.id) ?? false
  }));
}

export async function listGroups(): Promise<AdminGroup[]> {
  await guardAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("groups")
    .select("id, parent_id, name, description, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) return [];

  return (data ?? []) as AdminGroup[];
}

export async function createGroup(data: {
  name: string;
  description?: string;
  parent_id?: string | null;
}): Promise<{ group?: AdminGroup; error?: string }> {
  const current = await guardAdmin();
  const admin = createAdminClient();
  const name = data.name.trim();
  const description = data.description?.trim() || null;
  const parentId = data.parent_id || null;

  if (!name) return { error: "Group name is required." };

  const { data: group, error } = await admin
    .from("groups")
    .insert({
      name,
      description,
      parent_id: parentId,
      created_by: current.profile.id
    })
    .select("id, parent_id, name, description, created_at, updated_at")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog(admin, current.profile.id, "group_created", name, "groups", group.id);

  return { group: group as AdminGroup };
}

function isDescendant(
  groups: Pick<AdminGroup, "id" | "parent_id">[],
  possibleParentId: string,
  groupId: string
) {
  let currentId: string | null = possibleParentId;

  while (currentId) {
    if (currentId === groupId) return true;
    currentId = groups.find((group) => group.id === currentId)?.parent_id ?? null;
  }

  return false;
}

export async function updateGroup(
  groupId: string,
  data: { name: string; description?: string; parent_id?: string | null }
): Promise<{ group?: AdminGroup; error?: string }> {
  const current = await guardAdmin();
  const admin = createAdminClient();
  const name = data.name.trim();
  const description = data.description?.trim() || null;
  const parentId = data.parent_id || null;

  if (!name) return { error: "Group name is required." };
  if (parentId === groupId) return { error: "A group cannot be its own parent." };

  if (parentId) {
    const { data: groups } = await admin.from("groups").select("id, parent_id");
    if (isDescendant((groups ?? []) as Pick<AdminGroup, "id" | "parent_id">[], parentId, groupId)) {
      return { error: "A group cannot be moved inside one of its subgroups." };
    }
  }

  const { data: group, error } = await admin
    .from("groups")
    .update({ name, description, parent_id: parentId })
    .eq("id", groupId)
    .select("id, parent_id, name, description, created_at, updated_at")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog(admin, current.profile.id, "group_updated", name, "groups", groupId);

  return { group: group as AdminGroup };
}

export async function deleteGroup(groupId: string): Promise<{ error?: string }> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const { data: group } = await admin
    .from("groups")
    .select("name")
    .eq("id", groupId)
    .single();

  const { error } = await admin.from("groups").delete().eq("id", groupId);
  if (error) return { error: error.message };

  await writeAuditLog(
    admin,
    current.profile.id,
    "group_deleted",
    group?.name ?? groupId,
    "groups",
    groupId
  );

  return {};
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

  const [{ data: authUser }, { error }] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin.from("profiles").update({ role }).eq("id", userId)
  ]);
  if (error) return { error: error.message };

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...(authUser?.user?.app_metadata ?? {}), role }
  });

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

export async function resendUserInvite(userId: string): Promise<{ error: string } | null> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const [{ data: profile }, { data: authUser, error: userError }] = await Promise.all([
    admin.from("profiles").select("display_name, username").eq("id", userId).single(),
    admin.auth.admin.getUserById(userId)
  ]);

  if (userError || !authUser?.user) {
    return { error: userError?.message ?? "User not found" };
  }

  const email = authUser.user.email;
  const username = profile?.username;
  if (!email || !username) {
    return { error: "User is missing an email address or username." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
  try {
    await sendInviteEmail(email, username, appUrl);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send invite email" };
  }

  const displayName = profile?.display_name ?? username;
  await writeAuditLog(admin, current.profile.id, "settings_updated", `Invite resent to ${displayName}`, "profiles", userId);

  return null;
}

export async function resetUserTwoFactor(userId: string): Promise<{ error: string } | null> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const [{ data: profile }, { data: authUser, error: userError }, { data: factorsData, error: factorsError }] = await Promise.all([
    admin.from("profiles").select("display_name, username").eq("id", userId).single(),
    admin.auth.admin.getUserById(userId),
    admin.auth.admin.mfa.listFactors({ userId })
  ]);

  if (userError || !authUser?.user) {
    return { error: userError?.message ?? "User not found" };
  }
  if (factorsError) return { error: factorsError.message };

  const factors = normalizeMfaFactors(factorsData as MfaFactorsResponse);
  const totpFactors = factors.filter((factor) => factor.factor_type === "totp");

  for (const factor of totpFactors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId
    });
    if (error) return { error: error.message };
  }

  const { error } = await admin
    .from("profiles")
    .update({ totp_setup_required: true })
    .eq("id", userId);

  if (error) return { error: error.message };

  const displayName = profile?.display_name ?? profile?.username ?? userId;
  await writeAuditLog(admin, current.profile.id, "two_fa_reset", displayName, "profiles", userId);

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

export async function sendAdminTestEmail(): Promise<{ error: string } | null> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  try {
    await sendResendTestEmail();
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send test email" };
  }

  await writeAuditLog(admin, current.profile.id, "settings_updated", "Resend test email sent");

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
