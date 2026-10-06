import type { AuthorizedUser } from "@/lib/auth/authorization";
import { LogoutButton } from "@/components/auth/logout-button";
import { NavLinks } from "./nav-links";

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
        <div
          className="flex h-16 shrink-0 items-center gap-2.5 px-5"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
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
            <p className="text-[10px] font-medium" style={{ color: "var(--sidebar-text)" }}>
              Inventory Management
            </p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p
            className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "#475569" }}
          >
            StockFlow
          </p>
          <NavLinks admin={user.role === "ADMIN"} />
        </div>

        {/* User footer */}
        <div className="shrink-0 p-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <div className="flex items-center gap-3 rounded-lg p-2">
            <UserInitials name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-200">{user.name}</p>
              <p className="text-xs" style={{ color: "var(--sidebar-text)" }}>
                {user.role}
              </p>
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
          style={{
            background: "var(--header-bg)",
            borderColor: "var(--header-border)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Mobile: menu + logo */}
          <div className="flex items-center gap-3 lg:hidden">
            <details className="relative">
              <summary
                className="btn-secondary flex size-9 cursor-pointer list-none items-center justify-center rounded-lg p-0"
                aria-label="Open menu"
              >
                <svg
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </summary>
              <div
                className="absolute top-11 left-0 w-64 rounded-xl p-3 shadow-2xl"
                style={{
                  background: "var(--sidebar-bg)",
                  border: "1px solid var(--sidebar-border)",
                }}
              >
                <div className="mb-3 flex items-center gap-2.5 px-2">
                  <div
                    className="flex size-7 items-center justify-center rounded-lg text-white"
                    style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                  >
                    <svg
                      className="size-3.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-white">StockFlow</span>
                </div>
                <NavLinks admin={user.role === "ADMIN"} />
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
              <svg
                className="size-3.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
                style={{ color: "var(--primary)" }}
              >
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
