"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { InactivityGuard } from "@/components/InactivityGuard";

type AppShellProps = {
  children: React.ReactNode;
  userRole?: "super_admin" | "editor" | "viewer";
  inactivityTimeout?: number;
};

export function AppShell({ children, userRole = "super_admin", inactivityTimeout = 30 }: AppShellProps) {
  const pathname = usePathname();

  const navItems = [
    { href: "/knowledge-base", label: "Knowledge Base", icon: BookOpenText },
    ...(userRole === "super_admin"
      ? [{ href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard }]
      : []),
    { href: "/settings", label: "Settings", icon: Settings }
  ];

  function handleNavClick(href: string, e: React.MouseEvent) {
    if (pathname === href && href === "/knowledge-base") {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("kb-navigate-home"));
    }
  }

  return (
    <div className="app-shell-root min-h-screen lg:flex">
      <header className="app-shell-mobile-header sticky top-0 z-40 border-b border-line bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/knowledge-base"
            onClick={(e) => handleNavClick("/knowledge-base", e)}
            className="focus-ring flex min-w-0 items-center gap-2 rounded-lg px-2 py-2"
          >
            <BookOpenText className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
            <span className="truncate text-sm font-bold text-ink">IT Support KB</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(item.href, e)}
                  title={item.label}
                  aria-label={item.label}
                  className={`focus-ring flex h-10 w-10 items-center justify-center rounded-lg ${
                    isActive
                      ? "bg-mist text-ink"
                      : "text-slate-500 hover:bg-panel hover:text-ink"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </Link>
              );
            })}
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                title="Sign out"
                aria-label="Sign out"
                className="focus-ring flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-panel hover:text-ink"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <aside className="app-shell-sidebar hidden w-72 shrink-0 border-r border-line bg-white/88 px-5 py-6 lg:block">
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
                onClick={(e) => handleNavClick(item.href, e)}
                className="flex items-center gap-3 rounded-lg bg-mist px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-line"
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
      <main className="app-shell-main min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="app-shell-inner mx-auto max-w-7xl">{children}</div>
      </main>
      <InactivityGuard timeoutMinutes={inactivityTimeout} />
    </div>
  );
}
