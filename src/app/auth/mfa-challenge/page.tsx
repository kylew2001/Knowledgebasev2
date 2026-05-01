import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { MfaChallengeForm } from "./MfaChallengeForm";

export default async function MfaChallengePage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  const { next } = await searchParams;

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(current.user.id);
  const factors = authUser?.user?.factors ?? [];
  const totpFactor = factors.find(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );

  if (!totpFactor) {
    redirect("/auth/setup-2fa");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <MfaChallengeForm factorId={totpFactor.id} next={next ?? "/knowledge-base"} />
    </main>
  );
}
