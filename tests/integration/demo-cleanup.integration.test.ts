import "dotenv/config";
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma as db } from "../../src/lib/db/prisma";
import {
  inspectDemoFixtures,
  removeDemoFixturesInTransaction,
} from "../../src/modules/maintenance/services";
if (process.env.STOCKFLOW_DATABASE_TARGET !== "development-disposable")
  throw new Error("Requires confirmed disposable development database");
afterAll(async () => {
  await db.$disconnect();
});
describe("owner-authorized fixture cleanup (entire test rolls back)", () => {
  it("backs up exact decimal facts, blocks outside links, preserves other records and reenables history guards", async () => {
    const rollback = new Error("ROLLBACK_CLEANUP_VERIFICATION");
    let verified = false;
    const usersBefore = await db.user.count();
    await expect(
      db.$transaction(
        async (tx) => {
          const actor = await tx.user.create({
            data: {
              name: "Cleanup verifier",
              email: `${randomUUID()}@cleanup.invalid`,
              role: "ADMIN",
            },
          });
          const plan = await inspectDemoFixtures(actor, tx);
          expect(plan.rows.length).toBeGreaterThan(0);
          expect(plan.blockers).toEqual([]);
          for (const role of ["MANAGER", "STAFF"] as const)
            await expect(inspectDemoFixtures({ ...actor, role }, tx)).rejects.toThrow("permission");
          const product = plan.rows.find((r) => r.table === "Product")!;
          const source = await tx.product.findUniqueOrThrow({ where: { id: product.record.id } });
          const outside = await tx.product.create({
            data: {
              name: "Ordinary real stock item",
              sku: randomUUID(),
              categoryId: source.categoryId,
              inventoryUnitId: source.inventoryUnitId,
            },
          });
          const blocked = await inspectDemoFixtures(actor, tx);
          expect(blocked.blockers.some((b) => b.includes("Product.categoryId"))).toBe(true);
          await expect(
            removeDemoFixturesInTransaction(
              {
                requestKey: randomUUID(),
                fingerprint: blocked.fingerprint,
                confirmation: "REMOVE DEMO",
              },
              actor,
              tx,
            ),
          ).rejects.toThrow("linked");
          await tx.product.delete({ where: { id: outside.id } });
          await expect(
            removeDemoFixturesInTransaction(
              { requestKey: randomUUID(), fingerprint: "stale", confirmation: "REMOVE DEMO" },
              actor,
              tx,
            ),
          ).rejects.toThrow("changed");
          const input = {
            requestKey: randomUUID(),
            fingerprint: plan.fingerprint,
            confirmation: "REMOVE DEMO",
          };
          const invoiceCount = await tx.salesInvoice.count();
          const result = await removeDemoFixturesInTransaction(input, actor, tx);
          expect((await removeDemoFixturesInTransaction(input, actor, tx)).id).toBe(result.id);
          expect((await inspectDemoFixtures(actor, tx)).rows).toEqual([]);
          expect(await tx.salesInvoice.count()).toBe(
            invoiceCount - plan.counts.find((c) => c.table === "SalesInvoice")!.count,
          );
          expect(await tx.user.findUnique({ where: { id: actor.id } })).not.toBeNull();
          const archive = await tx.demoCleanupArchive.findUniqueOrThrow({
            where: { id: result.id },
          });
          const backup = archive.backup as {
            rows: { table: string; record: Record<string, unknown> }[];
          };
          expect(archive.recordCount).toBe(plan.rows.length);
          expect(typeof backup.rows.find((r) => r.table === "InventoryLot")?.record.unitCost).toBe(
            "string",
          );
          const disabled = await tx.$queryRaw<
            { count: bigint }[]
          >`SELECT COUNT(*) AS count FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O'`;
          expect(Number(disabled[0]!.count)).toBe(0);
          await expect(tx.demoCleanupArchive.delete({ where: { id: result.id } })).rejects.toThrow(
            "permanent",
          );
          // A deliberate SQL exception aborts the transaction as well; outer catch verifies no changes persist.
          verified = true;
          throw rollback;
        },
        { timeout: 180000, maxWait: 10000 },
      ),
    ).rejects.toThrow("ROLLBACK_CLEANUP_VERIFICATION");
    expect(verified).toBe(true);
    expect(await db.user.count()).toBe(usersBefore);
  }, 200000);
});
