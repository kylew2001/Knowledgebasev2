import { LockKeyhole } from "lucide-react";
import { signIn } from "@/app/auth/actions";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-soft">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand text-white">
            <LockKeyhole className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand">Secure sign in</p>
            <h1 className="text-2xl font-bold text-ink">IT Support KB</h1>
          </div>
        </div>
        <form action={signIn} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              required
              name="email"
              type="email"
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input
              required
              name="password"
              type="password"
              className="focus-ring mt-2 h-11 w-full rounded-lg border border-line px-3"
            />
          </label>
          <button className="focus-ring h-11 w-full rounded-lg bg-brand text-sm font-bold text-white hover:bg-teal-800">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
