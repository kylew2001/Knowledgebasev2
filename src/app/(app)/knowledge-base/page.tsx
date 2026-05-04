import { KnowledgeBase } from "@/components/knowledge-base";
import { getDatabasePosts, getKnowledgeBaseSettings, getPostUserState } from "@/app/(app)/knowledge-base/actions";
import { getCurrentProfile, getCurrentUserGroupIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function KnowledgeBasePage() {
  const supabase = await createClient();
  const [current, userGroupIds, { data: groups }, posts, postUserState, settings] = await Promise.all([
    getCurrentProfile(),
    getCurrentUserGroupIds(),
    supabase.from("groups").select("id, parent_id, name").order("name", { ascending: true }),
    getDatabasePosts(),
    getPostUserState(),
    getKnowledgeBaseSettings()
  ]);
  const role = current?.profile.role ?? "viewer";
  return (
    <KnowledgeBase
      userRole={role}
      userGroupIds={userGroupIds}
      groups={groups ?? []}
      initialPosts={posts}
      initialPostUserState={postUserState}
      initialStoredCategories={settings.categories}
      initialDeletedPostIds={settings.deletedPostIds}
    />
  );
}
