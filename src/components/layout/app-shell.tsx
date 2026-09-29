import Link from "next/link";

import type { AuthorizedUser } from "@/lib/auth/authorization";
import { LogoutButton } from "@/components/auth/logout-button";

const links = [
  ["Dashboard", "/"],
  ["Products", "/products"],
  ["Categories", "/categories"],
  ["Units", "/units"],
  ["Suppliers", "/suppliers"],
  ["Customers", "/customers"],
] as const;

export function AppShell({ user, children }: { user: AuthorizedUser; children: React.ReactNode }) {
  const nav = (
    <nav className="space-y-1" aria-label="Primary navigation">
      {links.map(([label, href]) => (
        <Link
          className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden bg-slate-950 p-5 lg:block">
        <Link className="mb-8 block text-xl font-semibold text-white" href="/">
          StockFlow
        </Link>
        {nav}
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <details className="relative lg:hidden">
            <summary className="btn-secondary cursor-pointer list-none">Menu</summary>
            <div className="absolute top-12 left-0 w-56 rounded-xl bg-slate-950 p-3 shadow-xl">
              {nav}
            </div>
          </details>
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-slate-900">StockFlow Inventory Management</p>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
