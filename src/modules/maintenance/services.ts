import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertRole, type AuthorizedUser } from "@/lib/auth/authorization";
import { ApplicationError } from "@/lib/errors/application-error";
import { parseIdentifier } from "@/lib/validation/identifier";
import { cleanupTables, isDemoTestActor, isDemoProduct, type CleanupTable } from "./fixture-policy";
type Database = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;
type Row = { id: string; [key: string]: Prisma.JsonValue };
type FixtureRow = { table: CleanupTable; record: Row };
type ForeignKey = { source: string; target: string; column: string; targetColumn: string };
const ownedTables = [
  "Expense",
  "Estimate",
  "Purchase",
  "PurchaseLot",
  "PurchaseReturn",
  "SalesInvoice",
  "SaleReturn",
  "StockAdjustment",
  "StockMovement",
  "Payment",
  "SupplierLedgerEntry",
  "CustomerLedgerEntry",
];
const childOwner: Partial<Record<CleanupTable, [CleanupTable, string]>> = {
  PurchaseLine: ["Purchase", "purchaseId"],
  InventoryLot: ["Product", "productId"],
  SalesInvoiceLine: ["SalesInvoice", "salesInvoiceId"],
  SaleLotAllocation: ["SalesInvoiceLine", "salesInvoiceLineId"],
  SaleReturnLine: ["SaleReturn", "saleReturnId"],
  SaleReturnAllocation: ["SaleReturnLine", "saleReturnLineId"],
  PurchaseReturnLine: ["PurchaseReturn", "purchaseReturnId"],
  StockAdjustmentLine: ["StockAdjustment", "stockAdjustmentId"],
  SupplierPaymentAllocation: ["Payment", "paymentId"],
  CustomerPaymentAllocation: ["Payment", "paymentId"],
};
// Catalog identifiers are escaped, never supplied by a client.
function identifier(value: string) {
  return Prisma.raw(`"${value.replaceAll('"', '""')}"`);
}
function fail(message: string): never {
  throw new ApplicationError("VALIDATION_ERROR", message);
}
const array = (values: string[]) => Prisma.sql`ARRAY[${Prisma.join(values)}]::uuid[]`;
function ids(rows: FixtureRow[], table: string) {
  return rows.filter((r) => r.table === table).map((r) => r.record.id);
}
function fingerprint(rows: FixtureRow[]) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

export async function inspectDemoFixtures(actor: AuthorizedUser, db: Database = prisma) {
  assertRole(actor, ["ADMIN"]);
  const users = await db.$queryRaw<
    Array<{ id: string; name: string; email: string }>
  >`SELECT id, name, email FROM "User" WHERE email LIKE '%@example.test'`;
  const actors = users.filter((u) => isDemoTestActor(u.name, u.email));
  if (actors.some((a) => a.id === actor.id)) fail("A test user cannot authorize its own cleanup.");
  const numericColumns = await db.$queryRaw<
    Array<{ table: string; column: string }>
  >`SELECT table_name AS "table", column_name AS "column" FROM information_schema.columns WHERE table_schema='public' AND data_type='numeric' ORDER BY table_name, column_name`;
  const record = (table: string) => {
    const columns = numericColumns.filter((c) => c.table === table);
    return columns.length
      ? Prisma.sql`to_jsonb(r) || jsonb_build_object(${Prisma.join(columns.flatMap((c) => [Prisma.sql`${c.column}::text`, Prisma.sql`r.${identifier(c.column)}::text`]))})`
      : Prisma.sql`to_jsonb(r)`;
  };
  let rows: FixtureRow[] = [];
  if (actors.length) {
    const actorIds = array(actors.map((a) => a.id));
    const names = Prisma.sql`ARRAY[${Prisma.join([...new Set(actors.map((a) => a.name))])}]::text[]`;
    const selects = cleanupTables
      .filter((t) => ownedTables.includes(t))
      .map(
        (t) =>
          Prisma.sql`SELECT ${t}::text AS "table", ${record(t)} AS record FROM ${identifier(t)} r WHERE "createdById" = ANY(${actorIds})`,
      );
    selects.push(
      Prisma.sql`SELECT 'User'::text AS "table", to_jsonb(r) AS record FROM "User" r WHERE id=ANY(${actorIds})`,
    );
    for (const t of ["Product", "Category", "Supplier", "Customer"] as const) {
      selects.push(
        Prisma.sql`SELECT ${t}::text AS "table", ${record(t)} AS record FROM ${identifier(t)} r WHERE name=ANY(${names})`,
      );
    }
    selects.push(
      Prisma.sql`SELECT 'ExpenseCategory'::text AS "table", to_jsonb(r) AS record FROM "ExpenseCategory" r WHERE name IN (SELECT unnest(${names}) || '-inactive')`,
    );
    rows = await db.$queryRaw<FixtureRow[]>(Prisma.join(selects, " UNION ALL "));
    rows = rows.filter(
      (r) => r.table !== "Product" || isDemoProduct(String(r.record.name), String(r.record.sku)),
    );
    rows = rows.filter((r) => r.table !== "Customer" || r.record.isWalkIn !== true);
    if (rows.length > 10000)
      fail("More than 10,000 demo rows found. Use a reviewed maintenance job instead.");
    const collected = new Set(rows.map((r) => `${r.table}:${r.record.id}`));
    for (let depth = 0; depth < 4; depth++) {
      const children = Object.entries(childOwner).flatMap(([table, [parent, column]]) => {
        const parents = ids(rows, parent);
        return parents.length
          ? [
              Prisma.sql`SELECT ${table}::text AS "table", ${record(table)} AS record FROM ${identifier(table)} r WHERE ${identifier(column)}=ANY(${array(parents)})`,
            ]
          : [];
      });
      if (!children.length) break;
      const added = (await db.$queryRaw<FixtureRow[]>(Prisma.join(children, " UNION ALL "))).filter(
        (r) => !collected.has(`${r.table}:${r.record.id}`),
      );
      if (!added.length) break;
      for (const row of added) collected.add(`${row.table}:${row.record.id}`);
      rows.push(...added);
      if (rows.length > 10000) fail("Too many linked demo rows for interactive cleanup.");
    }
  }
  rows.sort((a, b) => `${a.table}:${a.record.id}`.localeCompare(`${b.table}:${b.record.id}`));
  if (Buffer.byteLength(JSON.stringify(rows)) > 10 * 1024 * 1024)
    fail("The backup exceeds the interactive cleanup limit.");
  const blockers: string[] = [];
  if (rows.length) {
    const keys = await db.$queryRaw<ForeignKey[]>`
      SELECT s.relname AS source, t.relname AS target, sa.attname AS "column", ta.attname AS "targetColumn"
      FROM pg_constraint c JOIN pg_class s ON s.oid=c.conrelid JOIN pg_class t ON t.oid=c.confrelid
      JOIN pg_namespace n ON n.oid=s.relnamespace
      JOIN pg_attribute sa ON sa.attrelid=s.oid AND sa.attnum=c.conkey[1]
      JOIN pg_attribute ta ON ta.attrelid=t.oid AND ta.attnum=c.confkey[1]
      WHERE c.contype='f' AND n.nspname='public' AND array_length(c.conkey,1)=1`;
    const checks = keys.flatMap((k) => {
      const targets = ids(rows, k.target),
        sources = ids(rows, k.source);
      if (!targets.length) return [];
      return [
        Prisma.sql`SELECT ${`${k.source}.${k.column}`}::text AS link FROM ${identifier(k.source)} WHERE ${identifier(k.column)}=ANY(${array(targets)}) ${sources.length ? Prisma.sql`AND id <> ALL(${array(sources)})` : Prisma.empty} LIMIT 1`,
      ];
    });
    if (checks.length) {
      const outside = await db.$queryRaw<Array<{ link: string }>>(
        Prisma.join(
          checks.map((c) => Prisma.sql`(${c})`),
          " UNION ALL ",
        ),
      );
      blockers.push(...outside.map((o) => `A record outside this demo set uses ${o.link}.`));
    }
    const walkInIds = new Set(
      (
        await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Customer" WHERE "isWalkIn"=true`
      ).map((r) => r.id),
    );
    // A fixture must never touch real product layers or ordinary business parties.
    for (const k of keys) {
      if (!cleanupTables.includes(k.target as CleanupTable)) continue;
      if (k.target === "ExpenseCategory") continue; // Foundation expense categories are shared.
      const targets = new Set(ids(rows, k.target));
      for (const r of rows.filter((r) => r.table === k.source)) {
        const target = r.record[k.column];
        if (!target || targets.has(String(target))) continue;
        if (r.table === "Expense" && k.column === "voidedById") continue;
        if (k.target === "Customer" && walkInIds.has(String(target))) continue;
        blockers.push(`Demo ${r.table} references a record outside this set (${k.target}).`);
      }
    }
  }
  return {
    rows,
    fingerprint: fingerprint(rows),
    blockers: [...new Set(blockers)],
    actors: actors.map((a) => ({ name: a.name, id: a.id })),
    counts: cleanupTables
      .map((table) => ({ table, count: ids(rows, table).length }))
      .filter((r) => r.count),
  };
}

export async function removeDemoFixtures(
  input: { requestKey: string; fingerprint: string; confirmation: string },
  actor: AuthorizedUser,
) {
  return prisma.$transaction((tx) => removeDemoFixturesInTransaction(input, actor, tx), {
    isolationLevel: "Serializable",
    timeout: 120000,
    maxWait: 10000,
  });
}
export async function removeDemoFixturesInTransaction(
  input: { requestKey: string; fingerprint: string; confirmation: string },
  actor: AuthorizedUser,
  tx: Prisma.TransactionClient,
) {
  assertRole(actor, ["ADMIN"]);
  const requestKey = parseIdentifier(input.requestKey, "Cleanup request");
  if (input.confirmation !== "REMOVE DEMO")
    fail("Type REMOVE DEMO to confirm the previewed test data cleanup.");
  // Serialize the exceptional maintenance window; FK checks remain enabled.
  await tx.$executeRaw(
    Prisma.sql`LOCK TABLE ${Prisma.join(cleanupTables.map(identifier))} IN ACCESS EXCLUSIVE MODE`,
  );
  const prior = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM "DemoCleanupArchive" WHERE id=${requestKey}::uuid AND "createdById"=${actor.id}::uuid`;
  if (prior[0]) return prior[0];
  const plan = await inspectDemoFixtures(actor, tx);
  if (!plan.rows.length) fail("No recognized demo test records remain.");
  if (plan.blockers.length)
    fail(
      "Cleanup stopped: demo records are linked to data outside this set. Review the listed links.",
    );
  if (plan.fingerprint !== input.fingerprint)
    fail(
      "Demo data changed since the preview. Refresh and review the new backup before removing it.",
    );
  const disabled = await tx.$queryRaw<
    Array<{ name: string }>
  >`SELECT tgname AS name FROM pg_trigger tr JOIN pg_class t ON t.oid=tr.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND NOT tr.tgisinternal AND tr.tgenabled <> 'O' AND t.relname=ANY(ARRAY[${Prisma.join(cleanupTables)}]::text[])`;
  if (disabled.length)
    fail(
      "Cleanup requires the normal enabled business guardrails. Review database trigger configuration first.",
    );
  await tx.$executeRaw`INSERT INTO "DemoCleanupArchive" (id, "createdById", "recordCount", backup) VALUES (${requestKey}::uuid, ${actor.id}::uuid, ${plan.rows.length}, ${JSON.stringify({ version: 1, rows: plan.rows })}::jsonb)`;
  // User-requested removal of positively identified automated fixtures only.
  // Trigger changes roll back atomically on ANY error; no foreign-key trigger is disabled.
  for (const table of cleanupTables)
    if (ids(plan.rows, table).length)
      await tx.$executeRaw(Prisma.sql`ALTER TABLE ${identifier(table)} DISABLE TRIGGER USER`);
  for (const table of cleanupTables) {
    const selected = ids(plan.rows, table);
    if (selected.length)
      await tx.$executeRaw(
        Prisma.sql`DELETE FROM ${identifier(table)} WHERE id=ANY(${array(selected)})`,
      );
  }
  for (const table of cleanupTables)
    if (ids(plan.rows, table).length)
      await tx.$executeRaw(Prisma.sql`ALTER TABLE ${identifier(table)} ENABLE TRIGGER USER`);
  return { id: requestKey };
}
