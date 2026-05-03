"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export type OwnAccountChangeRequest = {
  id: string;
  request_type: "email_change" | "two_fa_reset" | "password_reset";
  proposed_value: string | null;
  status: "pending" | "approved" | "denied";
  admin_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

function isStrongPassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
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
    // Audit failures should not block account settings changes.
  }
}

export async function updateOwnDisplayName(displayName: string): Promise<{ error?: string }> {
  const current = await getCurrentProfile();
  if (!current) return { error: "You must be signed in." };

  const trimmed = displayName.trim();
  if (!trimmed) return { error: "Display name is required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ display_name: trimmed })
    .eq("id", current.profile.id);

  if (error) return { error: error.message };
  await writeAuditLog(admin, current.profile.id, "settings_updated", "Display name changed", "profiles", current.profile.id);
  return {};
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ error?: string }> {
  const current = await getCurrentProfile();
  if (!current?.user.email) return { error: "You must be signed in." };
  if (!currentPassword) return { error: "Current password is required." };
  if (!isStrongPassword(newPassword)) return { error: "New password does not meet the password rules." };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: current.user.email,
    password: currentPassword
  });

  if (signInError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  const admin = createAdminClient();
  await writeAuditLog(admin, current.profile.id, "password_reset", "Password changed", "profiles", current.profile.id);
  return {};
}

export async function createAccountChangeRequest(
  requestType: "email_change" | "two_fa_reset",
  proposedValue: string
): Promise<{ error?: string }> {
  const current = await getCurrentProfile();
  if (!current) return { error: "You must be signed in." };

  const value = requestType === "email_change" ? proposedValue.trim().toLowerCase() : proposedValue.trim();
  if (requestType === "email_change" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { error: "Enter a valid email address." };
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("account_change_requests")
    .select("id")
    .eq("user_id", current.profile.id)
    .eq("request_type", requestType)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return { error: "You already have a pending request for this change." };

  const { error } = await admin.from("account_change_requests").insert({
    user_id: current.profile.id,
    username: current.user.user_metadata?.username ?? null,
    request_type: requestType,
    proposed_value: requestType === "two_fa_reset" ? null : value
  });

  if (error) return { error: error.message };

  await writeAuditLog(
    admin,
    current.profile.id,
    "account_change_requested",
    requestType === "email_change" ? `Email change requested: ${value}` : "2FA reset requested",
    "profiles",
    current.profile.id
  );
  return {};
}

export async function listOwnAccountChangeRequests(): Promise<OwnAccountChangeRequest[]> {
  const current = await getCurrentProfile();
  if (!current) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_change_requests")
    .select("id, request_type, proposed_value, status, admin_reason, created_at, reviewed_at")
    .eq("user_id", current.profile.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data) return [];
  return data as OwnAccountChangeRequest[];
}
