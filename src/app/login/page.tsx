import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl sm:p-9">
        <p className="text-sm font-semibold tracking-[0.2em] text-indigo-600 uppercase">
          StockFlow V1.0
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Sign in with the account created by your StockFlow administrator.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
