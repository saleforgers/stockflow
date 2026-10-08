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

- Application release commit: `b3702c96cb41dd84b754ed4a884f70ba509147a5` (implementation commit `11268831d68fac3e7c8496597705cd4e5bd499b7`, followed by native backup-connection compatibility).
- [Final acceptance and production preflight](https://github.com/saleforgers/stockflow/actions/runs/37745434115): successful. All 57 unit tests and 28 selected database integration tests passed. Lint, TypeScript and Prisma validation passed; all twelve migrations applied successfully to the isolated service.
- [Controlled production migration](https://github.com/saleforgers/stockflow/actions/runs/37745709177): successful. The encrypted backup was preserved before both new migrations applied. The final schema check verified twelve applied migrations with matching checksums.
- Vercel Production deployment: `dpl_4Qkg9bto6AV2FPMVRfC1h3h6zCyW`, `READY`, built from the release commit. The Production build's real runtime database fingerprint matched the migration project fingerprint `26dafa28c54a2920`. Project build settings remain unchanged. The staged deployment was promoted after migration succeeded.
- Canonical [live StockFlow](https://stockflow-brown-mu.vercel.app) alias was assigned to the promoted release. Read-only live checks passed all 72 requests: 54 protected pages redirected to sign-in, five protected PDF/backup handlers rejected unauthenticated access, and login, JavaScript/CSS assets, PDF worker and unauthenticated session behavior passed. The login page also rendered correctly in the browser.
- Read-only production catalog checks confirmed `purchase_supplier_invoice_ref_unique` and the one-paisa `PurchaseLine_quantity_cost_valid` constraint. No production fixtures or historical document corrections were written.
- The encrypted backup is saved locally at ignored `output/release-2026-10-08/backup/public-schema.dump.encrypted`, alongside the separately saved private key. Authenticated decryption verified a valid PostgreSQL custom archive in memory, without writing plaintext. Encrypted size: 256,030 bytes; archive size: 255,191 bytes; encrypted SHA256: `1c9410c6fe04c35b9068ec4032562cccf174bd94ecde3645e2032a8271e3fe3a`.

Production checks covered deployment identity, schema, authentication boundaries and public assets. An authenticated operator walkthrough was not performed because no operator login credential is available to this session. Posting behavior was accepted against the isolated database. Repository-wide formatting still flags the four pre-existing supplied audit/prompt/skill inputs documented in the implementation report; changed implementation files pass formatting.
