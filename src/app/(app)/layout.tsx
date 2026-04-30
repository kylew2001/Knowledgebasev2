import { AppShell } from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!hasSupabaseEnv) {
    return <AppShell userRole="super_admin">{children}</AppShell>;
  }

  const current = await getCurrentProfile();

  if (!current) {
    redirect("/login");
  }

  return <AppShell userRole={current.profile.role}>{children}</AppShell>;
}
