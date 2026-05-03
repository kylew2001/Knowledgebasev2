import PersonalSettings from "@/components/PersonalSettings";
import { getCurrentProfile } from "@/lib/auth";
import { listOwnAccountChangeRequests } from "@/app/(app)/settings/actions";

export default async function SettingsPage() {
  const current = await getCurrentProfile();

  if (!current) {
    return (
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <p className="text-sm text-slate-500">Unable to load settings. Please sign in again.</p>
      </section>
    );
  }

  const requests = await listOwnAccountChangeRequests();

  return (
    <PersonalSettings
      displayName={current.profile.display_name ?? ""}
      email={current.user.email ?? ""}
      requests={requests}
    />
  );
}
