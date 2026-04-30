import Link from "next/link";
import { BookOpenText, LayoutDashboard, LogOut, Settings } from "lucide-react";

type AppShellProps = {
  children: React.ReactNode;
  userRole?: "super_admin" | "editor" | "viewer";
};

export function AppShell({ children, userRole = "super_admin" }: AppShellProps) {
  const navItems = [
    { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpenText },
    ...(userRole === "super_admin"
      ? [{ href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard }]
      : []),
    { href: "/settings", label: "Settings", icon: Settings, muted: true }
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-72 shrink-0 border-r border-line bg-white/88 px-5 py-6 lg:block">
        <div className="mb-9">
          <p className="text-sm font-semibold text-brand">IT Support</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-ink">
            Knowledge Base
          </h1>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  item.muted
                    ? "text-slate-400 hover:bg-slate-50"
                    : "bg-mist text-ink hover:bg-line"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-10 rounded-lg border border-line bg-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Current Role
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">{userRole}</p>
        </div>
        <form action="/auth/sign-out" method="post" className="mt-5">
          <button className="focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-100">
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Sign out
          </button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
