import { KnowledgeBase } from "@/components/knowledge-base";
import { getDatabasePosts, getPostUserState } from "@/app/(app)/knowledge-base/actions";
import { getCurrentProfile, getCurrentUserGroupIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function KnowledgeBasePage() {
  const supabase = await createClient();
  const [current, userGroupIds, { data: groups }, posts, postUserState] = await Promise.all([
    getCurrentProfile(),
    getCurrentUserGroupIds(),
    supabase.from("groups").select("id, parent_id, name").order("name", { ascending: true }),
    getDatabasePosts(),
    getPostUserState()
  ]);
  const role = current?.profile.role ?? "viewer";
  return <KnowledgeBase userRole={role} userGroupIds={userGroupIds} groups={groups ?? []} initialPosts={posts} initialPostUserState={postUserState} />;
}
