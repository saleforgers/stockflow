"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-8 space-y-5"
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
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          autoFocus
          className="input mt-1"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="input mt-1"
          id="password"
          minLength={12}
          name="password"
          required
          type="password"
        />
      </div>
      {error ? (
        <p aria-live="polite" className="text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      <button className="btn-primary w-full" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
