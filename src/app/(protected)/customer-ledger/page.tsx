import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/ui/page-header";
export default async function Page() {
  await requireUser();
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, isActive: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        title="Customer ledger"
        description="Open an account to see invoices, receipts, credits and running balance."
      />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Status</th>
              <th>Account</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.isActive ? "Active" : "Inactive"}</td>
                <td>
                  <Link prefetch={false} href={`/customers/${c.id}/account`}>
                    View ledger
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
