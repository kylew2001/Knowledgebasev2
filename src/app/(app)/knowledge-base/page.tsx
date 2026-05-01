import { KnowledgeBase } from "@/components/knowledge-base";
import { getCurrentProfile, getCurrentUserGroupIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function KnowledgeBasePage() {
  const supabase = await createClient();
  const [current, userGroupIds, { data: groups }] = await Promise.all([
    getCurrentProfile(),
    getCurrentUserGroupIds(),
    supabase.from("groups").select("id, parent_id, name").order("name", { ascending: true })
  ]);
  const role = current?.profile.role ?? "viewer";
  return <KnowledgeBase userRole={role} userGroupIds={userGroupIds} groups={groups ?? []} />;
}
