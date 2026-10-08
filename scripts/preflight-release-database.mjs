import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import pg from "pg";

// Read-only metadata only; safe for production build and controlled migration jobs.
async function main() {
  const runtime = process.argv.includes("--runtime");
  const connectionString = process.env[runtime ? "DATABASE_URL" : "DIRECT_URL"];
  if (!connectionString) throw new Error("Preflight: required database setting is missing");
  const url = new URL(connectionString);
  // Direct and Supavisor URLs identify the same Supabase project differently.
  const project = url.hostname.startsWith("db.")
    ? url.hostname.split(".")[1]
    : decodeURIComponent(url.username).split(".").at(-1);
  const projectFingerprint = createHash("sha256").update(project).digest("hex").slice(0, 16);
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '20s'");
    const version = await client.query("SELECT current_setting('server_version') AS version");
    const migrations = await client.query(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"',
    );
    if (migrations.rows.some((row) => !row.finished_at && !row.rolled_back_at)) {
      throw new Error("Preflight: unresolved failed migration");
    }
    const directories = (await readdir("prisma/migrations", { withFileTypes: true })).filter(
      (entry) => entry.isDirectory(),
    );
    const pending = [];
    for (const directory of directories) {
      const sql = await readFile(`prisma/migrations/${directory.name}/migration.sql`, "utf8");
      const lf = sql.replaceAll("\r\n", "\n");
      const checksums = [sql, lf, lf.replaceAll("\n", "\r\n")].map((bytes) =>
        createHash("sha256").update(bytes).digest("hex"),
      );
      const applied = migrations.rows.find(
        (row) => row.migration_name === directory.name && row.finished_at && !row.rolled_back_at,
      );
      if (!applied) pending.push(directory.name);
      else if (!checksums.includes(applied.checksum)) {
        throw new Error(`Preflight: applied migration checksum mismatch: ${directory.name}`);
      }
    }
    const duplicates = await client.query(`
      SELECT count(*)::int AS groups FROM (
        SELECT 1 FROM "Purchase" WHERE "supplierInvoiceRef" IS NOT NULL
        GROUP BY "supplierId", "supplierInvoiceRef" HAVING count(*) > 1
      ) duplicated
    `);
    if (duplicates.rows[0].groups !== 0) {
      throw new Error("Preflight: duplicate supplier invoice reference groups require review");
    }
    await client.query("ROLLBACK");
    console.info(
      JSON.stringify({
        check: "release-database-preflight",
        connection: runtime ? "runtime" : "migration",
        projectFingerprint,
        postgresVersion: version.rows[0].version,
        appliedMigrations: migrations.rows.filter((row) => row.finished_at && !row.rolled_back_at)
          .length,
        pendingMigrations: pending,
        duplicateSupplierInvoiceGroups: duplicates.rows[0].groups,
      }),
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error && error.message.startsWith("Preflight:")
      ? error.message
      : "Preflight: database connection failed; inspect connectivity securely",
  );
  process.exitCode = 1;
});
