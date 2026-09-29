import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma CLI and migration operations must bypass the serverless
    // transaction pooler used by the application runtime.
    url: process.env["DIRECT_URL"],
  },
});
