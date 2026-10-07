import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";

// Read-only release check. Never logs connection URLs, passwords, or business rows.
async function main() {
  const connectionString = process.env["DIRECT_URL"];
  if (!connectionString) throw new Error("DIRECT_URL is required for release verification");
  const url = new URL(connectionString);
  const targetFingerprint = createHash("sha256")
    .update(`${url.hostname}/${url.username}/${url.pathname}`)
    .digest("hex")
    .slice(0, 16);
  const client = new Client({ connectionString, connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const migrations = await client.query<{
      migration_name: string;
      checksum: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
    }>(
      'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name',
    );
    if (migrations.rows.some((row) => !row.finished_at && !row.rolled_back_at))
      throw new Error("Release schema is not ready: an unresolved failed migration exists");
    const directories = (await readdir("prisma/migrations", { withFileTypes: true })).filter(
      (entry) => entry.isDirectory(),
    );
    const missing: string[] = [];
    for (const directory of directories) {
      const sql = await readFile(`prisma/migrations/${directory.name}/migration.sql`);
      const checksum = createHash("sha256").update(sql).digest("hex");
      // Windows checkouts may use CRLF; Prisma's applied migration may use Git LF bytes.
      const normalizedSql = sql.toString().replaceAll("\r\n", "\n");
      const lfChecksum = createHash("sha256").update(normalizedSql).digest("hex");
      const crlfChecksum = createHash("sha256")
        .update(normalizedSql.replaceAll("\n", "\r\n"))
        .digest("hex");
      const applied = migrations.rows.find(
        (row) => row.migration_name === directory.name && row.finished_at && !row.rolled_back_at,
      );
      if (!applied || ![checksum, lfChecksum, crlfChecksum].includes(applied.checksum))
        missing.push(directory.name);
    }
    const columns = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='PurchaseLine' AND column_name IN ('unitPurchasePrice','grossAmount','lineDiscountAmount')`,
    );
    if (missing.length || columns.rows.length !== 3) {
      throw new Error(
        `Release schema is not ready: ${missing.join(", ") || "required PurchaseLine columns are missing"}`,
      );
    }
    await client.query("ROLLBACK");
    console.info(
      `Release schema verified: ${directories.length} migrations, matching checksums, all purchase discount columns. Target fingerprint: ${targetFingerprint}`,
    );
  } finally {
    await client.end();
  }
}
main().catch((error: unknown) => {
  // Raw driver errors may include connection information; show only known release errors.
  console.error(
    error instanceof Error &&
      (error.message.startsWith("Release schema") ||
        error.message === "DIRECT_URL is required for release verification")
      ? error.message
      : "Release database verification failed; inspect connectivity securely.",
  );
  process.exitCode = 1;
});
