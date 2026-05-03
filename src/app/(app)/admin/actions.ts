"use server";

import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, isSuperAdmin } from "@/lib/auth";
import { sendInviteEmail, sendPasswordResetEmail, sendResendTestEmail } from "@/lib/email";
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
  group_ids: string[];
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

export type SharedPostLink = {
  id: string;
  post_id: string;
  post_title: string;
  post_category: string;
  post_subcategory: string;
  created_by_name: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export type AccountChangeRequest = {
  id: string;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  email: string | null;
  request_type: "email_change" | "two_fa_reset" | "password_reset";
  proposed_value: string | null;
  status: "pending" | "approved" | "denied";
  admin_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
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

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

  const [{ data: profiles }, { data: authData }, { data: memberships }] = await Promise.all([
    admin.from("profiles").select("id, display_name, username, role, disabled_at, last_login_at, totp_setup_required"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("user_groups").select("user_id, group_id")
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
  const groupMap = new Map<string, string[]>();
  (memberships ?? []).forEach((membership) => {
    const userId = membership.user_id as string;
    const groupId = membership.group_id as string;
    groupMap.set(userId, [...(groupMap.get(userId) ?? []), groupId]);
  });

  return profiles.map((p) => ({
    ...p,
    email: emailMap.get(p.id) ?? "",
    has_totp: totpMap.get(p.id) ?? false,
    group_ids: groupMap.get(p.id) ?? []
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
  data: { display_name?: string; email?: string; username?: string; group_ids?: string[] }
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

  if (data.group_ids) {
    const { error: deleteError } = await admin.from("user_groups").delete().eq("user_id", userId);
    if (deleteError) return { error: deleteError.message };

    if (data.group_ids.length > 0) {
      const { error: insertError } = await admin.from("user_groups").insert(
        data.group_ids.map((groupId) => ({
          user_id: userId,
          group_id: groupId
        }))
      );
      if (insertError) return { error: insertError.message };
    }
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

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from("profiles").select("display_name, username").eq("id", userId).single(),
    admin.auth.admin.getUserById(userId)
  ]);

  const email = authUser.user?.email;
  if (!email) return { error: "User is missing an email address." };

  const { error } = await admin
    .from("profiles")
    .update({ force_password_change: true })
    .eq("id", userId);

  if (error) return { error: error.message };

  const resetToken = randomBytes(32).toString("base64url");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
  const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;
  const { error: tokenError } = await admin.from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: hashResetToken(resetToken),
    reason: "admin_password_reset",
    created_by: current.profile.id,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });

  if (tokenError) return { error: tokenError.message };

  try {
    await sendPasswordResetEmail(email, resetUrl);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to send password reset email" };
  }

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

  const setupToken = randomBytes(32).toString("base64url");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
  const setupUrl = `${appUrl.replace(/\/$/, "")}/reset-password/${setupToken}`;
  const { error: tokenError } = await admin.from("password_reset_tokens").insert({
    user_id: userId,
    token_hash: hashResetToken(setupToken),
    reason: "invite_resend",
    created_by: current.profile.id,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  if (tokenError) return { error: tokenError.message };

  try {
    await sendInviteEmail(email, username, setupUrl);
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

export async function listSharedPostLinks(): Promise<SharedPostLink[]> {
  await guardAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("post_shares")
    .select(`
      id,
      post_id,
      created_at,
      expires_at,
      revoked_at,
      kb_posts(title, category, subcategory),
      profiles!post_shares_created_by_fkey(display_name, username)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map((row) => {
    const typed = row as unknown as {
      id: string;
      post_id: string;
      created_at: string;
      expires_at: string;
      revoked_at: string | null;
      kb_posts: { title: string; category: string; subcategory: string } | null;
      profiles: { display_name: string | null; username: string | null } | null;
    };

    return {
      id: typed.id,
      post_id: typed.post_id,
      post_title: typed.kb_posts?.title ?? "Deleted post",
      post_category: typed.kb_posts?.category ?? "",
      post_subcategory: typed.kb_posts?.subcategory ?? "",
      created_by_name: typed.profiles?.display_name ?? typed.profiles?.username ?? "Unknown",
      created_at: typed.created_at,
      expires_at: typed.expires_at,
      revoked_at: typed.revoked_at
    };
  });
}

export async function revokeSharedPostLink(shareId: string) {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const { data: share } = await admin
    .from("post_shares")
    .select("id, post_id")
    .eq("id", shareId)
    .single();

  const { error } = await admin
    .from("post_shares")
    .update({ revoked_at: new Date().toISOString(), revoked_by: current.user.id })
    .eq("id", shareId);

  if (error) return { error: error.message };

  await writeAuditLog(admin, current.profile.id, "post_share_revoked", share?.post_id ?? shareId);
  return null;
}

export async function listAccountChangeRequests(): Promise<AccountChangeRequest[]> {
  await guardAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("account_change_requests")
    .select(`
      id,
      user_id,
      username,
      request_type,
      proposed_value,
      status,
      admin_reason,
      created_at,
      reviewed_at,
      profiles!account_change_requests_user_id_fkey(display_name, username)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  const authUsers = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map((authUsers.data?.users ?? []).map((user) => [user.id, user.email ?? null]));

  return data.map((row) => {
    const typed = row as unknown as {
      id: string;
      user_id: string | null;
      username: string | null;
      request_type: AccountChangeRequest["request_type"];
      proposed_value: string | null;
      status: AccountChangeRequest["status"];
      admin_reason: string | null;
      created_at: string;
      reviewed_at: string | null;
      profiles: { display_name: string | null; username: string | null } | null;
    };

    return {
      id: typed.id,
      user_id: typed.user_id,
      username: typed.profiles?.username ?? typed.username,
      display_name: typed.profiles?.display_name ?? null,
      email: typed.user_id ? emailMap.get(typed.user_id) ?? null : null,
      request_type: typed.request_type,
      proposed_value: typed.proposed_value,
      status: typed.status,
      admin_reason: typed.admin_reason,
      created_at: typed.created_at,
      reviewed_at: typed.reviewed_at
    };
  });
}

async function resolveRequestTarget(
  admin: ReturnType<typeof createAdminClient>,
  request: { user_id: string | null; username: string | null }
) {
  if (request.user_id) return request.user_id;
  if (!request.username) return null;

  const { data } = await admin
    .rpc("lookup_user_by_username", { p_username: request.username.toLowerCase().trim() })
    .maybeSingle();

  return (data as { user_id?: string } | null)?.user_id ?? null;
}

export async function approveAccountChangeRequest(requestId: string): Promise<{ error?: string }> {
  const current = await guardAdmin();
  const admin = createAdminClient();

  const { data: request, error: requestError } = await admin
    .from("account_change_requests")
    .select("id, user_id, username, request_type, proposed_value, status")
    .eq("id", requestId)
    .single();

  if (requestError || !request) return { error: "Request not found." };
  if (request.status !== "pending") return { error: "Request has already been reviewed." };

  const userId = await resolveRequestTarget(admin, request);
  if (!userId) return { error: "Could not find the target user." };

  if (request.request_type === "email_change") {
    if (!request.proposed_value) return { error: "No proposed email was supplied." };
    const { error } = await admin.auth.admin.updateUserById(userId, { email: request.proposed_value });
    if (error) return { error: error.message };
  }

  if (request.request_type === "two_fa_reset") {
    const { data: factorsData, error: factorsError } = await admin.auth.admin.mfa.listFactors({ userId });
    if (factorsError) return { error: factorsError.message };

    const factors = normalizeMfaFactors(factorsData as MfaFactorsResponse);
    for (const factor of factors.filter((item) => item.factor_type === "totp")) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
      if (error) return { error: error.message };
    }

    const { error } = await admin
      .from("profiles")
      .update({ totp_setup_required: true })
      .eq("id", userId);
    if (error) return { error: error.message };
  }

  if (request.request_type === "password_reset") {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const email = authUser.user?.email;
    if (!email) return { error: "User is missing an email address." };

    const resetToken = randomBytes(32).toString("base64url");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";
    const resetUrl = `${appUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;
    const { error: tokenError } = await admin.from("password_reset_tokens").insert({
      user_id: userId,
      token_hash: hashResetToken(resetToken),
      reason: "password_reset_request",
      created_by: current.profile.id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
    if (tokenError) return { error: tokenError.message };

    const { error } = await admin
      .from("profiles")
      .update({ force_password_change: true })
      .eq("id", userId);
    if (error) return { error: error.message };

    try {
      await sendPasswordResetEmail(email, resetUrl);
    } catch (err) {
      return {
        error: `Reset was approved, but the email failed: ${
          err instanceof Error ? err.message : "Unknown email error"
        }`
      };
    }
  }

  const { error } = await admin
    .from("account_change_requests")
    .update({
      user_id: userId,
      status: "approved",
      reviewed_by: current.profile.id,
      reviewed_at: new Date().toISOString(),
      admin_reason: null
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  await writeAuditLog(admin, current.profile.id, "account_change_approved", request.request_type, "profiles", userId);
  return {};
}

export async function denyAccountChangeRequest(
  requestId: string,
  reason: string
): Promise<{ error?: string }> {
  const current = await guardAdmin();
  const admin = createAdminClient();
  const trimmedReason = reason.trim();

  if (!trimmedReason) return { error: "A denial reason is required." };

  const { data: request } = await admin
    .from("account_change_requests")
    .select("id, user_id, username, request_type, status")
    .eq("id", requestId)
    .single();

  if (!request) return { error: "Request not found." };
  if (request.status !== "pending") return { error: "Request has already been reviewed." };

  const { error } = await admin
    .from("account_change_requests")
    .update({
      status: "denied",
      admin_reason: trimmedReason,
      reviewed_by: current.profile.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  await writeAuditLog(
    admin,
    current.profile.id,
    "account_change_denied",
    `${request.request_type}: ${trimmedReason}`,
    request.user_id ? "profiles" : undefined,
    request.user_id ?? undefined
  );
  return {};
}
