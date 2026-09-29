import Link from "next/link";

import type { AuthorizedUser } from "@/lib/auth/authorization";
import { LogoutButton } from "@/components/auth/logout-button";

const links = [
  {
    label: "Dashboard",
    href: "/",
    icon: (
      <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: "Products",
    href: "/products",
    icon: (
      <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: "Categories",
    href: "/categories",
    icon: (
      <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    label: "Units",
    href: "/units",
    icon: (
      <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Suppliers",
    href: "/suppliers",
    icon: (
      <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: "Customers",
    href: "/customers",
    icon: (
      <svg className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
] as const;

function NavLinks({ onClick }: { onClick?: () => void }) {
  return (
    <nav className="space-y-0.5" aria-label="Primary navigation">
      {links.map(({ label, href, icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onClick}
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150"
          style={{ color: "var(--sidebar-text)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--sidebar-text-hover)";
            (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLAnchorElement).style.color = "var(--sidebar-text)";
            (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
          }}
        >
          {icon}
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function UserInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

export function AppShell({ user, children }: { user: AuthorizedUser; children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside
        className="fixed inset-y-0 left-0 hidden w-60 flex-col lg:flex"
        style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--sidebar-border)" }}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 px-5" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
          <div
            className="flex size-8 items-center justify-center rounded-lg text-white"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <svg className="size-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">StockFlow</p>
            <p className="text-[10px] font-medium" style={{ color: "var(--sidebar-text)" }}>Inventory Management</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#475569" }}>
            Master Data
          </p>
          <NavLinks />
        </div>

        {/* User footer */}
        <div className="shrink-0 p-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center gap-3 rounded-lg p-2">
            <UserInitials name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{user.name}</p>
              <p className="text-xs" style={{ color: "var(--sidebar-text)" }}>{user.role}</p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────── */}
      <div className="lg:pl-60">
        {/* Top header */}
        <header
          className="sticky top-0 z-20 flex h-16 items-center justify-between border-b px-4 sm:px-6"
          style={{ background: "var(--header-bg)", borderColor: "var(--header-border)", backdropFilter: "blur(12px)" }}
        >
          {/* Mobile: menu + logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <details className="relative">
              <summary
                className="btn-secondary flex size-9 cursor-pointer list-none items-center justify-center rounded-lg p-0"
                aria-label="Open menu"
              >
                <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </summary>
              <div
                className="absolute top-11 left-0 w-64 rounded-xl p-3 shadow-2xl"
                style={{ background: "var(--sidebar-bg)", border: "1px solid var(--sidebar-border)" }}
              >
                <div className="mb-3 flex items-center gap-2.5 px-2">
                  <div
                    className="flex size-7 items-center justify-center rounded-lg text-white"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                  >
                    <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-white">StockFlow</span>
                </div>
                <NavLinks />
              </div>
            </details>
            <span className="text-sm font-semibold text-slate-900">StockFlow</span>
          </div>

          {/* Desktop: breadcrumb area */}
          <div className="hidden lg:flex lg:items-center lg:gap-2">
            <div
              className="flex size-7 items-center justify-center rounded-md"
              style={{ background: "var(--primary-light)" }}
            >
              <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true" style={{ color: "var(--primary)" }}>
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--primary-text)" }}>
              StockFlow Inventory
            </span>
          </div>

          {/* User info (desktop header) */}
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role}</p>
            </div>
            <UserInitials name={user.name} />
          </div>
        </header>

        {/* Page content */}
        <main className="mx-auto max-w-7xl animate-fade-in space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
