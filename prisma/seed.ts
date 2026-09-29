import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedFoundationData } from "./seed-data";

const databaseUrl = process.env["DIRECT_URL"];

if (!databaseUrl) {
  throw new Error("DIRECT_URL is required to run the seed");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function seed() {
  await seedFoundationData(prisma);
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
