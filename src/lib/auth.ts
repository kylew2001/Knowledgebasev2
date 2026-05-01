import { createClient } from "@/lib/supabase/server";

export type UserRole = "super_admin" | "editor" | "viewer";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, disabled_at")
    .eq("id", user.id)
    .single();

  if (!profile || profile.disabled_at) {
    return null;
  }

  return {
    user,
    profile: profile as {
      id: string;
      display_name: string | null;
      role: UserRole;
      disabled_at: string | null;
    }
  };
}

export async function getCurrentUserGroupIds() {
  const current = await getCurrentProfile();
  if (!current) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_groups")
    .select("group_id")
    .eq("user_id", current.profile.id);

  return (data ?? []).map((row) => row.group_id as string);
}

export function canEdit(role: UserRole) {
  return role === "super_admin" || role === "editor";
}

export function isSuperAdmin(role: UserRole) {
  return role === "super_admin";
}
