import Link from "next/link";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const metadata = { title: "Dashboard" };

async function getDashboardCounts() {
  const [products, categories, suppliers, customers] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.category.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.customer.count({ where: { isActive: true } }),
  ]);
  return { products, categories, suppliers, customers };
}

const statCards = [
  {
    key: "products",
    label: "Active Products",
    href: "/products",
    color: "#6366f1",
    lightColor: "#eef2ff",
    icon: (
      <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    key: "categories",
    label: "Categories",
    href: "/categories",
    color: "#0ea5e9",
    lightColor: "#f0f9ff",
    icon: (
      <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    key: "suppliers",
    label: "Suppliers",
    href: "/suppliers",
    color: "#f59e0b",
    lightColor: "#fffbeb",
    icon: (
      <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    key: "customers",
    label: "Customers",
    href: "/customers",
    color: "#10b981",
    lightColor: "#ecfdf5",
    icon: (
      <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
] as const;

const moduleLinks = [
  { label: "Products", desc: "Manage your product catalogue and SKUs", href: "/products", color: "#6366f1" },
  { label: "Categories", desc: "Organize products by category", href: "/categories", color: "#0ea5e9" },
  { label: "Units of Measure", desc: "Define inventory units and decimal scales", href: "/units", color: "#8b5cf6" },
  { label: "Suppliers", desc: "Manage supplier contact details", href: "/suppliers", color: "#f59e0b" },
  { label: "Customers", desc: "Manage customer accounts and contacts", href: "/customers", color: "#10b981" },
] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const counts = await getDashboardCounts();

  return (
    <>
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Good day, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-slate-500">
          Here&apos;s an overview of your master data. Purchasing, sales, and analytics arrive in later phases.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ key, label, href, color, lightColor, icon }) => (
          <Link
            key={key}
            href={href}
            className="card card-hover flex flex-col gap-4 p-5 no-underline"
          >
            <div className="flex items-center justify-between">
              <div
                className="flex size-10 items-center justify-center rounded-xl"
                style={{ background: lightColor, color }}
              >
                {icon}
              </div>
              <svg
                className="size-4 text-slate-300 transition-colors group-hover:text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>
                {counts[key as keyof typeof counts]}
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-500">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Phase info banner */}
      <div
        className="flex items-start gap-4 rounded-xl p-5"
        style={{
          background: "linear-gradient(135deg, #f0f4ff, #fdf4ff)",
          border: "1px solid #e0e7ff",
        }}
      >
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white" }}
        >
          <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-slate-900">Phase 1B — Master Data Active</p>
          <p className="mt-0.5 text-sm text-slate-600">
            Products, categories, units, suppliers, and customers are fully managed here.
            Stock movements, purchasing, sales, payments, and analytics will be added in upcoming phases.
          </p>
        </div>
      </div>

      {/* Module quick links */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {moduleLinks.map(({ label, desc, href, color }) => (
            <Link
              key={href}
              href={href}
              className="card card-hover flex items-center gap-4 p-4 no-underline"
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `${color}18`, color }}
              >
                <svg className="size-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
