import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  parseDatabaseAdministrationEnvironment,
  parseServerEnvironment,
} from "../src/lib/env/schema";

type ConnectionSummary = {
  database: string;
  user: string;
  version: string;
};

async function checkConnection(label: string, connectionString: string) {
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const [summary] = await client.$queryRaw<ConnectionSummary[]>`
      SELECT
        current_database() AS database,
        current_user AS user,
        current_setting('server_version') AS version
    `;

    if (!summary) {
      throw new Error(`${label} returned no connection metadata`);
    }

    console.info(
      `${label}: connected (database=${summary.database}, user=${summary.user}, PostgreSQL=${summary.version})`,
    );
  } finally {
    await client.$disconnect();
  }
}

async function main() {
  const runtime = parseServerEnvironment(process.env);
  const administration = parseDatabaseAdministrationEnvironment(process.env);

  await checkConnection("DATABASE_URL runtime connection", runtime.DATABASE_URL);
  await checkConnection("DIRECT_URL migration connection", administration.DIRECT_URL);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Database connectivity check failed");
  process.exitCode = 1;
});
