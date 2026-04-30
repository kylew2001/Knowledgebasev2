import { KnowledgeBase } from "@/components/knowledge-base";
import { getCurrentProfile } from "@/lib/auth";

export default async function KnowledgeBasePage() {
  const current = await getCurrentProfile();
  const role = current?.profile.role ?? "viewer";
  return <KnowledgeBase userRole={role} />;
}
