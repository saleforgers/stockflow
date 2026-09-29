import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { parseDatabaseAdministrationEnvironment } from "../src/lib/env/schema";

async function main() {
  if (process.env["STOCKFLOW_DATABASE_TARGET"] !== "development-disposable") {
    throw new Error(
      "Refusing database inspection unless STOCKFLOW_DATABASE_TARGET=development-disposable",
    );
  }

  const { DIRECT_URL } = parseDatabaseAdministrationEnvironment(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DIRECT_URL }) });

  try {
    const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;

    console.info(
      tables.length === 0
        ? "Development public schema is empty and ready for the initial migration."
        : `Development public tables (${tables.length}): ${tables.map(({ name }) => name).join(", ")}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database readiness inspection failed");
  process.exitCode = 1;
});
