# Implementation prompt fixes — 2026-10-08

The owner requested implementation of `CODEX_IMPLEMENTATION_PROMPT.md` after reading it with `CODEX_PROMPT_TEMPLATE.md` and `AUDIT_REPORT.md`. The template is empty. The ten specified fixes define this change; the audit's other recommendations remain deferred.

## Decisions before implementation

- Movement `occurredAt` uses the document's validated business date at UTC midnight. `createdAt` and `postedAt` continue to record execution time. Existing posted history and running-balance ordering are unchanged.
- Receipt and payment navigation links target the existing `/customer-receipts/new` and `/supplier-payments/new` routes. Partial invoice badges use the actual persisted `PARTIALLY_PAID` value.
- `AppShell` remains a Server Component. Only the mobile menu becomes a Client Component, preserving its Admin navigation flag and existing branding. The dismissal backdrop is portaled to the document body below the header's stacking level; the header's existing `backdrop-filter` otherwise confines a fixed backdrop to its 64px height.
- Inline validation uses the existing server action field-error keys and passes them to existing `FormField` instances. Errors take priority over hints; server validation rules do not change.
- Stock adjustment options receive product name and SKU separately from the existing page query so search and labels use the actual SKU without duplicating the combined label.
- Supplier invoice uniqueness follows the requested exact `(supplierId, supplierInvoiceRef)` partial index for all purchases, including drafts. Null references remain unrestricted; no case normalization or historical deduplication is introduced.
- Purchase cost reconstruction accepts an absolute difference of at most PKR 0.01 after rounding to money precision. The existing SQL `PurchaseLine` check also requires exact equality, so a new migration must give that check the same tolerance. Positive quantity/cost and authoritative net-total checks remain enforced. A derived cost rounded to zero remains invalid.
- The audit's quantity-7 example already reconstructs correctly (`7 × 9.9929 = 69.9503`, rounded to `69.95`). Regression cases will use quantities that actually produce one-paisa reconstruction differences.

## Database acceptance boundary

`docs/audit-fix-release-2026-10-08.md` records that the locally configured database overlaps the production migration target and is marked `shared-target-unconfirmed`. Never run fixture-writing integration acceptance against it. The owner subsequently explicitly authorized the complete production release without further routine confirmation. Acceptance now runs in an independent ephemeral PostgreSQL 17 service in GitHub Actions, with no production credentials available to that job. Production migrations remain a separate controlled deployment job after acceptance, runtime identity verification and an encrypted backup.

## Verification

- TypeScript (`npx tsc --noEmit`), ESLint (`npm run lint`) and Prisma validation (`npx prisma validate`) passed.
- All 57 unit tests passed across 19 suites. The first ordinary test invocation encountered Windows sandbox temporary-file `ENOENT` loader errors before assertions; rerunning with workspace-local `TEMP`/`TMP` and `--maxWorkers=1` passed.
- Optimized Next.js production build passed. Windows sandbox filesystem canonicalization denied the initial build; a local build outside that sandbox succeeded using a process-only generated `AUTH_SECRET`. No environment files were changed.
- Prettier passed on every changed/new TypeScript and Markdown implementation file; `git diff --check` passed. Repository-wide `npm run format:check` still flags four pre-existing supplied files: `.agent/skills/code-review-ai-ai-review/SKILL.md`, `.agent/skills/codebase-cleanup-tech-debt/SKILL.md`, `AUDIT_REPORT.md`, and `CODEX_IMPLEMENTATION_PROMPT.md`. These inputs were preserved.
- Browser checks used actual components in a local fixture with stubbed server actions and Next navigation, without any database access. Single-match scanner Enter selected the product with zero form submissions; ambiguous/unmatched Enter did not submit. An action failure displayed its customer-name error inline, and an error suppressed its hint. Adjustment selection searched by SKU, showed current stock, calculated the difference, and cleared the prior count when switching products. Mobile navigation retained Admin links and closed on a navigation click and on backdrop click. With the header's blur styling, the backdrop covered the full 720px test viewport after the portal fix, rather than only the 64px header.
- Database regression coverage passed on the isolated PostgreSQL 17 service for sale/return/adjustment business dates, supplier-reference uniqueness (including concurrent attempts, separate suppliers and null/blank references), one-paisa purchase posting and retry, and direct SQL rejection outside the tolerance or at zero cost. All 28 selected integration tests passed across five suites; all twelve migrations applied and their checksums verified. The independently authorized production release subsequently applied both new migrations through the controlled job and verified the live constraints.

## Review state

All ten requested fixes are implemented. No dependencies were added and no applied migration or `schema.prisma` was changed. The two new SQL migrations must pass disposable database acceptance together before release. A read-only production preflight found ten applied migrations with matching checksums and zero duplicate supplier/reference groups. The index intentionally fails rather than rewriting existing history. Final release evidence is recorded separately after deployment.
