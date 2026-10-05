import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { parseDatabaseAdministrationEnvironment } from "../src/lib/env/schema";
import { recoverAdminCredential } from "../src/modules/authentication/services";

async function main() {
  const email = process.env["STOCKFLOW_ADMIN_EMAIL"];
  const password = process.env["STOCKFLOW_ADMIN_PASSWORD"];

  if (!email || !password) {
    throw new Error(
      "Set STOCKFLOW_ADMIN_EMAIL and STOCKFLOW_ADMIN_PASSWORD only for this recovery command.",
    );
  }

  const { DIRECT_URL } = parseDatabaseAdministrationEnvironment(process.env);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DIRECT_URL }) });

  try {
    const result = await recoverAdminCredential({ email, password }, prisma);
    console.info(
      `Admin credential recovered for ${email.toLowerCase()}${result.reactivated ? " and the account was reactivated" : ""}. Existing sessions were revoked. Remove the recovery variables now.`,
    );
  } finally {
    process.env["STOCKFLOW_ADMIN_PASSWORD"] = "";
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin credential recovery failed");
  process.exitCode = 1;
});
