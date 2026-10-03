import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { inspectDemoFixtures } from "@/modules/maintenance/services";
import { CleanupForm } from "@/modules/maintenance/cleanup-form";
export const maxDuration = 120;
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await requireRole(["ADMIN"]);
  const [plan, archives, query] = await Promise.all([
    inspectDemoFixtures(actor),
    prisma.demoCleanupArchive.findMany({
      select: { id: true, createdAt: true, recordCount: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    searchParams,
  ]);
  return (
    <>
      <PageHeader
        title="Demo Data Cleanup"
        description="Admin maintenance · Remove recognized automated test records after reviewing the backup."
      />
      {query.completed && (
        <p className="alert-success">
          Recognized test data removed. The backup is available below.
        </p>
      )}
      <div className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold">What Can Be Removed?</h2>
        <p className="text-sm text-slate-600">
          This tool recognizes only the automated P3-IT, EXP-IT and Demo acceptance fixtures created
          by test users with generated example.test emails. It does not offer a general database
          reset. Real products, accounts and finalized business documents keep their normal history
          protection.
        </p>
        <p className="text-sm text-slate-500">
          For normal business records: edit drafts, cancel expenses/estimates, create invoice
          returns, or deactivate master data.
        </p>
      </div>
      {plan.rows.length ? (
        <>
          <div className="card overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Recognized Test Records</th>
                  <th className="text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {plan.counts.map((c) => (
                  <tr key={c.table}>
                    <td>{c.table.replace(/([a-z])([A-Z])/g, "$1 $2")}</td>
                    <td className="text-right font-semibold tabular-nums">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="card p-5">
            <summary className="cursor-pointer font-semibold">Recognized Test Groups</summary>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {plan.actors.map((a) => (
                <li key={a.id}>{a.name}</li>
              ))}
            </ul>
          </details>
          <a className="btn-secondary w-fit" href="/settings/data-cleanup/backup">
            Download Preview Backup
          </a>
          {!!plan.blockers.length && (
            <div className="alert-error block">
              <h2 className="font-semibold">Cleanup Paused — Linked Business Data</h2>
              <ul className="mt-2 list-disc pl-5">
                {plan.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          {!plan.blockers.length && <CleanupForm fingerprint={plan.fingerprint} />}
        </>
      ) : (
        <p className="card p-8 text-slate-500">No recognized automated test records remain.</p>
      )}
      {!!archives.length && (
        <section className="card space-y-3 p-6">
          <h2 className="font-semibold">Saved Cleanup Backups</h2>
          {archives.map((a) => (
            <p key={a.id} className="flex flex-wrap justify-between gap-3 border-t pt-3">
              <span>
                {a.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} ·{" "}
                {a.recordCount} records
              </span>
              <Link className="text-indigo-700" href={`/settings/data-cleanup/backup?id=${a.id}`}>
                Download Backup
              </Link>
            </p>
          ))}
        </section>
      )}
    </>
  );
}
