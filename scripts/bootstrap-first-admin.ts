import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { parseDatabaseAdministrationEnvironment } from "../src/lib/env/schema";
import { bootstrapFirstAdmin } from "../src/modules/authentication/services";

async function main() {
  const name = process.env["STOCKFLOW_ADMIN_NAME"];
  const email = process.env["STOCKFLOW_ADMIN_EMAIL"];
  const password = process.env["STOCKFLOW_ADMIN_PASSWORD"];

  if (!name || !email || !password) {
    throw new Error(
      "Set STOCKFLOW_ADMIN_NAME, STOCKFLOW_ADMIN_EMAIL, and STOCKFLOW_ADMIN_PASSWORD only for this command.",
    );
  }

  const { DIRECT_URL } = parseDatabaseAdministrationEnvironment(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DIRECT_URL }) });

  try {
    await bootstrapFirstAdmin({ name, email, password }, prisma);
    console.info(
      `First Admin created for ${email.toLowerCase()}. Remove the bootstrap variables now.`,
    );
  } finally {
    process.env["STOCKFLOW_ADMIN_PASSWORD"] = "";
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "First Admin bootstrap failed");
  process.exitCode = 1;
});
