"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");
        const formData = new FormData(event.currentTarget);
        const result = await authClient.signIn.email({
          email: String(formData.get("email") ?? "")
            .trim()
            .toLowerCase(),
          password: String(formData.get("password") ?? ""),
          rememberMe: false,
        });
        if (result.error) {
          setError("Invalid email or password, or the account is inactive.");
          setPending(false);
          return;
        }
        router.replace("/");
        router.refresh();
      }}
    >
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="login-email">
          Email address
        </label>
        <input
          autoComplete="email"
          autoFocus
          className="input"
          id="login-email"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="login-password">
          Password
        </label>
        <div className="relative">
          <input
            autoComplete="current-password"
            className="input pr-10"
            id="login-password"
            minLength={12}
            name="password"
            placeholder="••••••••••••"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert-error" role="alert" aria-live="polite">
          <svg className="size-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      ) : null}

      <button
        className="btn-primary w-full py-2.5"
        disabled={pending}
        type="submit"
        id="login-submit"
      >
        {pending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            Signing in…
          </span>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
