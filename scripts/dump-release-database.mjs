import { spawn } from "node:child_process";

// libpq does not accept Node/Prisma-only URL parameters such as uselibpqcompat.
// Pass parsed connection fields through the environment, never CLI arguments.
const url = new URL(process.env.DIRECT_URL ?? "");
const child = spawn(
  "docker",
  [
    "run",
    "--rm",
    ...["PGHOST", "PGPORT", "PGUSER", "PGPASSWORD", "PGDATABASE", "PGSSLMODE"].flatMap((key) => [
      "-e",
      key,
    ]),
    "postgres:17",
    "pg_dump",
    "--schema=public",
    "--no-owner",
    "--no-acl",
    "--format=custom",
  ],
  {
    env: {
      ...process.env,
      PGHOST: url.hostname,
      PGPORT: url.port || "5432",
      PGUSER: decodeURIComponent(url.username),
      PGPASSWORD: decodeURIComponent(url.password),
      PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
      PGSSLMODE: url.searchParams.get("sslmode") || "require",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.pipe(process.stdout);
// Driver error messages can contain connection details; do not forward them.
child.stderr.resume();
child.on("error", () => {
  console.error("Public-schema backup process could not start");
  process.exitCode = 1;
});
child.on("close", (code) => {
  if (code !== 0) {
    console.error("Public-schema backup failed; migration must not proceed");
    process.exitCode = 1;
  }
});
