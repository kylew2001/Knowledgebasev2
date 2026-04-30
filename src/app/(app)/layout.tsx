import { AppShell } from "@/components/app-shell";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

async function getInactivityTimeout(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("security_settings")
      .select("inactivity_timeout_minutes")
      .single();
    return data?.inactivity_timeout_minutes ?? 30;
  } catch {
    return 30;
  }
}

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

  const [current, inactivityTimeout] = await Promise.all([
    getCurrentProfile(),
    getInactivityTimeout(),
  ]);

  if (!current) {
    redirect("/login");
  }

  return (
    <AppShell userRole={current.profile.role} inactivityTimeout={inactivityTimeout}>
      {children}
    </AppShell>
  );
}
