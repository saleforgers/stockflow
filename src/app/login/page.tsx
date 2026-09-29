import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = {
  title: "Sign In · StockFlow",
  description: "Sign in to StockFlow Inventory Management",
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
      }}
    >
      {/* Background decorative orbs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div
          className="absolute -top-40 -right-40 size-[500px] rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 -left-40 size-[400px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #8b5cf6, transparent 70%)" }}
        />
      </div>

      {/* Card */}
      <section className="relative z-10 w-full max-w-[420px]">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-4 flex size-14 items-center justify-center rounded-2xl shadow-xl"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <svg className="size-7 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Welcome to StockFlow</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Sign in to your inventory management account
          </p>
        </div>

        <div
          className="rounded-2xl p-7 shadow-2xl sm:p-8"
          style={{
            background: "rgba(255,255,255,0.97)",
            border: "1px solid rgba(255,255,255,0.2)",
            backdropFilter: "blur(20px)",
          }}
        >
          <LoginForm />
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Contact your administrator to create or reset your account.
        </p>
      </section>
    </main>
  );
}
