"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { label: "Dashboard", href: "/", icon: "▦" },
  { label: "Inventory", href: "/inventory", icon: "▤" },
  { label: "Products", href: "/products", icon: "□" },
  { label: "Purchases", href: "/purchases", icon: "↓" },
  { label: "Suppliers", href: "/suppliers", icon: "◇" },
  { label: "Invoices / Sales", href: "/sales", icon: "↑" },
  { label: "Customers", href: "/customers", icon: "○" },
  { label: "Estimates", href: "/estimates", icon: "▧" },
  { label: "Expenses", href: "/expenses", icon: "₨" },
  { label: "Reports", href: "/reports", icon: "≡" },
  { label: "Categories", href: "/categories", icon: "◈" },
  { label: "Units", href: "/units", icon: "↔" },
] as const;

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5" aria-label="Primary navigation">
      {links.map(({ label, href, icon }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ${
              isActive
                ? "bg-indigo-600/25 text-indigo-300 font-semibold border-l-2 border-indigo-400 pl-2.5 shadow-sm"
                : "text-slate-400 font-medium hover:text-white hover:bg-white/[0.06]"
            }`}
          >
            <span
              className={isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200"}
            >
              {icon}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
