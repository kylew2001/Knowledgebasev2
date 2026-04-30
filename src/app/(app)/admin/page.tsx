import { AdminDashboard } from "@/components/admin-dashboard";
import { getCurrentProfile, isSuperAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (hasSupabaseEnv) {
    const current = await getCurrentProfile();

    if (!current || !isSuperAdmin(current.profile.role)) {
      redirect("/knowledge-base");
    }
  }

  return <AdminDashboard />;
}
