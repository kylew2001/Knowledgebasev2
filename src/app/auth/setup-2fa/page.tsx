import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { SetupTwoFactorForm } from "./SetupTwoFactorForm";

export default async function SetupTwoFaPage() {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <SetupTwoFactorForm />
    </main>
  );
}
