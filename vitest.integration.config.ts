import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.integration.test.ts"],
    setupFiles: ["./tests/integration/setup.ts"],
    fileParallelism: false,
    // Multi-command acceptance cases use the remote Supabase database. Individual
    // posting transactions keep their own stricter application timeouts.
    testTimeout: 90_000,
    hookTimeout: 30_000,
  },
});
