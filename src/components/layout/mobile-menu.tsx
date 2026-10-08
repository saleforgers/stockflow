"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { NavLinks } from "./nav-links";

export function MobileMenu({ admin = false }: { admin?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuId = useId();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMobileOpen((open) => !open)}
        aria-expanded={mobileOpen}
        aria-controls={menuId}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        className="btn-secondary relative z-30 flex size-9 items-center justify-center rounded-lg p-0"
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
      </button>
      {mobileOpen && (
        <>
          {createPortal(
            <div
              className="fixed inset-0 z-10"
              aria-hidden="true"
              onClick={() => setMobileOpen(false)}
            />,
            document.body,
          )}
          <div
            id={menuId}
            className="absolute top-11 left-0 z-30 max-h-[calc(100dvh-5rem)] w-64 overflow-y-auto rounded-xl p-3 shadow-2xl"
            style={{
              background: "var(--sidebar-bg)",
              border: "1px solid var(--sidebar-border)",
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setMobileOpen(false);
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
            <NavLinks admin={admin} onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
