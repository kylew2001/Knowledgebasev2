import { PasswordResetForm } from "@/components/PasswordResetForm";

export default async function ResetPasswordPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-panel px-4 py-10">
      <PasswordResetForm token={token} />
    </main>
  );
}
