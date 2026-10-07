# StockFlow deployment and recent-work audit — 2026-10-08

## Verdict

The latest developer changes **are deployed to the canonical production URL**. The blanket claim that they are not live is contradicted by Vercel deployment metadata, build logs, alias resolution, and a new login-page control served over HTTP. Deployment does not establish successful database migration or acceptance of every protected workflow.

The local working checkout was stale: `main` remained at `1e33aab` from October 3. Remote `main` is `90c82dff0565f8760fef85e65a0a905db1382519`, authored by `waheeda129` on October 7 at 00:34:40 Pakistan time. Auditing only the original checkout would miss the recent work.

## Deployment evidence

| Check              | Observed result                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub remote main | `90c82dff0565f8760fef85e65a0a905db1382519`                                                                                           |
| Canonical URL      | https://stockflow-brown-mu.vercel.app                                                                                                |
| Deployment         | `dpl_J28hdAokjNBQvwgR6FZKCYWuzqnC`                                                                                                   |
| Deployment URL     | https://stockflow-ap2j8c0vf-sale-forgers.vercel.app                                                                                  |
| Target / state     | Production / READY                                                                                                                   |
| Build source       | Branch `main`, commit `90c82df`                                                                                                      |
| Creation time      | October 7, 2026, 00:35:05 Pakistan time                                                                                              |
| Aliases            | Canonical URL, `stockflow-sale-forgers.vercel.app`, and `stockflow-git-main-sale-forgers.vercel.app` all assigned to this deployment |
| Public response    | `/login` returned 200, Vercel cache MISS, and contained the new Show password control                                                |

The immediately preceding production deployment failed, but the subsequent deployment above succeeded and owns the canonical alias. That earlier failure does not establish that the current version is absent.

## Recent implementation reviewed

Six commits after the local checkout change 61 files. They add transaction party/product selectors, quick customer/supplier creation, party balances and stock context, purchase discounts and immediate purchase payments, product movement history, product opening stock, login controls, and an operator-only admin credential recovery command.

The posting changes retain server-side operational authorization and decimal calculations. Immediate purchase payment, allocation, payable entry, and stock posting occur in the same business transaction. Opening-stock creation also uses a transaction and records a lot, adjustment, and movement rather than independently editing stock. These are useful implementation choices, but database integration acceptance remains unverified in this audit.

## Findings

### High priority: database release state is unverified

The recent source requires `20261006010000_transaction_screen_enhancements`, adding required PurchaseLine columns `unitPurchasePrice`, `grossAmount`, and `lineDiscountAmount`. Vercel's install/build commands generate Prisma Client; they do not deploy migrations.

GitHub's latest controlled production migration run is [37119537121](https://github.com/saleforgers/stockflow/actions/runs/37119537121), from October 3 at commit `d8eee64`. No later run was returned. Consequently, there is no controlled-workflow evidence that the October 6 migration reached production. It could have been applied by another means; this audit has not proved that it is missing.

If those columns are absent, purchase detail/edit reads and draft writes can fail despite the Vercel build being Ready. The next check should inspect the production migration history and those three columns, then verify that the runtime database and migration target are the same project. Do not blindly deploy the migration based on this report alone.

Recent available runtime error logs showed an authentication redirect and a PostgreSQL client concurrency deprecation warning on a successful `/products` request. They did not establish a missing-column error. Absence of that error in the returned logs is not database acceptance.

### P2: new item history reintroduces misleading running stock balances

[Product history query at the audited commit](https://github.com/saleforgers/stockflow/blob/90c82dff0565f8760fef85e65a0a905db1382519/src/modules/products/queries.ts#L119) sorts by `occurredAt`, then creation time and ID, and accumulates running quantities in that order. The existing inventory movement screen was deliberately corrected on October 3 to use recorded creation order.

A receipt recorded first with a future receiving date, followed by an issue recorded later with an earlier business date, appears as an issue before its receipt on this new page. It can show a negative intermediate balance even though stock was available when issued. The final summed quantity remains correct; the running history is misleading and inconsistent with `/inventory/movements`. Reuse the existing audit-order balance convention and its future/backdated movement regression cases. This finding comes from source review, not a production transaction reproduction.

### P2: sales payment choices are only partially implemented

The October 6 requirements promise explicit Paid, Credit, and Partial Payment choices. [The final sales form](https://github.com/saleforgers/stockflow/blob/90c82dff0565f8760fef85e65a0a905db1382519/src/modules/sales/forms.tsx#L204) instead submits a hidden payment type inferred from the Paid Now amount; draft posting does the same. Purchase posting has an explicit selector.

This is a delivery mismatch, not evidence of a missing deployment. The backend recognizes paid/partial receipts, but a customer expecting the specified sales controls will not see them in the deployed implementation. Either implement the specified choices or explicitly agree to the inferred workflow.

## Verification and limits

- Latest source was inspected in an ignored temporary snapshot. The working branch and application source were not updated.
- Latest-source ESLint, TypeScript, all **49 unit tests across 18 files**, and Prisma schema validation passed.
- Production build logs independently confirm successful compilation and TypeScript checking for the audited SHA.
- Formatting checks fail. A line-ending-neutral follow-up still reports 11 files with formatting differences; archive LF versus Windows line endings inflated the initial snapshot result. The local checkout's combined `npm run check` also stopped at its formatter stage. Do not describe the combined quality gate as passing.
- Database integration tests were not run: they seed/write fixtures and require an independently confirmed disposable development target.
- No authenticated browser session was available. Protected business workflows, actual production schema, and runtime/migration database identity remain unverified.
- No deployment, migration, credential recovery, cleanup, or business transaction was performed.

Automatic approval review rejected downloading production environment credentials into an ignored local file because the audit request did not specifically authorize sensitive credential retrieval. That action was not retried or bypassed. Completing the direct schema check requires explicit approval for production credential retrieval and read-only database inspection, or a suitable existing authenticated connection.

## Recommended next step

Confirm the production schema first, then review the new forms in an authenticated production session without posting business records. Ask the developer to distinguish a missing migration, an incomplete feature, and an actual deployment issue. Current evidence supports “code is live; production acceptance is incomplete,” rather than “changes are not deployed.”
