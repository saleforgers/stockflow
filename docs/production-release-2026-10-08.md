# Implementation fixes production release — 2026-10-08

The owner explicitly authorized completing all release work and making production live. Scope remains the ten fixes in `CODEX_IMPLEMENTATION_PROMPT.md`, their SQL constraints, acceptance coverage and controlled deployment safeguards.

## Release procedure

1. Release branch verification applies all twelve migrations to an ephemeral PostgreSQL 17 service, isolated from production credentials, and runs the relevant append-only integration suites plus lint, TypeScript, unit tests and Prisma validation.
2. Read-only preflight checks applied migration checksums and duplicate supplier/reference groups. Production initially has PostgreSQL 17.6, ten applied migrations and zero duplicate groups. Its normalized Supabase project fingerprint is `26dafa28c54a2920`.
3. Stage a Production-target Vercel build with `--skip-domain`. A read-only build probe must report the same normalized project fingerprint using its real sensitive `DATABASE_URL`; no database settings or business rows are logged.
4. Run the controlled migration workflow with an RSA public key. PostgreSQL 17 `pg_dump` exports the complete public schema and its data, including Better Auth, migrations and document sequences, directly through AES-256-GCM encryption. The AES key is wrapped with RSA-OAEP-SHA256. No plaintext backup is written or uploaded. The encrypted artifact is retained for seven days and downloaded locally. The private key remains in ignored `output/release-2026-10-08/backup-private.pem` and is never committed or uploaded.
5. Apply the two reviewed migrations with `prisma migrate deploy`, then verify all migration checksums. Promote the staged application only after the migration job succeeds.
6. Check the live canonical URL, authentication boundaries, static assets and database constraints. Save final commit, workflow and deployment evidence below.

## Backup format and recovery

The encrypted file starts with a four-byte big-endian JSON-header length, followed by the JSON header, AES-GCM ciphertext and a sixteen-byte authentication tag. The header contains the base64 IV and RSA-wrapped AES key. Decrypt using the saved private key and OAEP SHA256, authenticate with AES-256-GCM, and only then use `pg_restore` against an explicitly approved restoration target. This backup covers StockFlow's public schema; it is not a platform-wide export of Supabase managed schemas or Storage objects.

The local encryption helper passed an encryption/decryption round-trip check. Prior production deployment for application rollback: `dpl_GvC5CYFQhFf9p7oP1sLn5g8pfsiP` at commit `b98689935d6958e4b60bbb7d9aa1eb8479701511`. The new index and relaxed rounding check are compatible with the prior application, so application rollback need not erase data or migration history.

## Final evidence

Release execution is pending the verification and controlled deployment jobs. No production fixture writes or historical document corrections are part of this release.
