import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import TwoFactorSettings from "@/components/TwoFactorSettings";

export default async function SettingsPage() {
  const current = await getCurrentProfile();

  if (!current) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm text-slate-500">Unable to load settings. Please sign in again.</p>
      </section>
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Settings</p>
        <h2 className="mt-1 text-3xl font-bold text-ink">Security</h2>
        <p className="mt-3 text-sm text-slate-500">
          Supabase environment variables are not configured.
        </p>
      </section>
    );
  }

  const admin = createAdminClient();
  const userId = current.user.id;

  const [{ data: profile }, { data: authUserData }] = await Promise.all([
    admin
      .from("profiles")
      .select("email_2fa_enabled")
      .eq("id", userId)
      .single(),
    admin.auth.admin.getUserById(userId)
  ]);

  const email = current.user.email ?? "";
  const emailTwoFaEnabled = profile?.email_2fa_enabled ?? false;
  const factors = authUserData?.user?.factors ?? [];
  const hasTOTP = factors.some(
    (f) => f.factor_type === "totp" && f.status === "verified"
  );

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm font-semibold text-brand">Account</p>
        <h2 className="mt-1 text-3xl font-bold text-ink">Security settings</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Manage two-factor authentication methods for your account.
        </p>
      </section>

      <TwoFactorSettings
        userId={userId}
        email={email}
        hasTOTP={hasTOTP}
        emailTwoFaEnabled={emailTwoFaEnabled}
      />
    </div>
  );
}
