import { afterAll, describe, expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client";
import { prisma } from "../../src/lib/db/prisma";
import { movementBalanceSql } from "../../src/modules/inventory/queries";

// Pure SELECT fixtures: no business rows, users, seeds or migrations are written.
const fixture = Prisma.sql`WITH movements(id, "productId", "locationId", direction, quantity, "occurredAt", "createdAt") AS (
 VALUES
 ('receipt', 'product', 'main', 'IN', 500.0000::numeric, '2026-10-03 18:00Z'::timestamptz, '2026-10-03 09:00Z'::timestamptz),
 ('sale', 'product', 'main', 'OUT', 20.0000::numeric, '2026-10-03 10:00Z'::timestamptz, '2026-10-03 10:00Z'::timestamptz),
 ('return', 'product', 'main', 'IN', 0.1250::numeric, '2026-10-02 00:00Z'::timestamptz, '2026-10-03 11:00Z'::timestamptz),
 ('other-location', 'product', 'other', 'IN', 7.0000::numeric, '2026-10-03 00:00Z'::timestamptz, '2026-10-03 08:00Z'::timestamptz)
), history AS (SELECT id, ${movementBalanceSql} AS balance FROM movements)`;

async function balances(query: Prisma.Sql) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.$queryRaw<{ id: string; balance: Prisma.Decimal }[]>(query);
  });
}

afterAll(() => prisma.$disconnect());

describe("recorded stock movement balances (read-only SQL)", () => {
  it("keeps future receipt dates and backdated returns from changing recorded balances", async () => {
    const rows = await balances(Prisma.sql`${fixture} SELECT * FROM history ORDER BY id`);
    expect(Object.fromEntries(rows.map((row) => [row.id, row.balance.toString()]))).toEqual({
      "other-location": "7",
      receipt: "500",
      return: "480.125",
      sale: "480",
    });
  });

  it("retains opening movements when returning a filtered or older page", async () => {
    const rows = await balances(
      Prisma.sql`${fixture} SELECT * FROM history WHERE id = ${"sale"} LIMIT 1`,
    );
    expect(rows.map((row) => [row.id, row.balance.toString()])).toEqual([["sale", "480"]]);
  });
});
