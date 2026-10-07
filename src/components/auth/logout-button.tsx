"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      title={pending ? "Signing out…" : "Sign out"}
      aria-label="Sign out"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
      type="button"
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 disabled:opacity-40"
    >
      {pending ? (
        <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      ) : (
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      )}
    </button>
  );
}
