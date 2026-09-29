# Authentication

Phase 1B uses Better Auth 1.7.6 with its official Prisma adapter. It was selected because the maintained release explicitly supports Next.js 16, React 19, Prisma 7, PostgreSQL, App Router route handlers, and database-backed sessions. Auth.js Credentials would require a less suitable JWT/custom credentials path for this requirement, and Lucia is deprecated.

Supabase remains only the managed PostgreSQL provider. StockFlow does not use Supabase Auth or a client-side Supabase SDK.

## Credentials and password storage

- Email/password sign-in is enabled; public sign-up is disabled.
- Better Auth stores credential hashes in `Account.password` for the `credential` provider, never on the `User` row.
- Better Auth's built-in `scrypt` implementation is memory-hard and manages unique salts. Passwords are never logged, returned, or placed in browser-visible server data.
- Login errors are deliberately generic so they do not reveal whether an email exists or an account is inactive.
- `AUTH_SECRET` must contain at least 32 high-entropy characters. `BETTER_AUTH_URL` is the canonical application origin. Neither may use `NEXT_PUBLIC_`.

## Sessions and request security

`Session` rows hold an opaque unique token, user, expiry, IP/user-agent context, and timestamps. Sessions expire after 12 hours and refresh after one hour of activity. Better Auth issues HttpOnly, SameSite=Lax cookies and uses Secure cookies in production. It creates a fresh token at sign-in and deletes the server-side session on sign-out.

Better Auth's origin checks remain enabled for CSRF protection. Server Actions add Next.js same-origin protections. No code disables CSRF or origin validation. The session cookie cache is not enabled, so protected decisions validate the persistent session. `getCurrentUser` also re-reads the User row and rejects inactive accounts, including accounts deactivated after a session was created.

Central helpers are:

- `getCurrentUser`: returns an active authenticated user or `null`.
- `requireUser`: throws a typed unauthenticated error.
- `requireRole`: validates an allowed database role.
- `assertMasterDataAdmin`: enforces Phase 1B's Admin-only mutation policy.

The protected App Router layout redirects unauthenticated page requests to `/login`. Every mutation independently calls `requireRole(["ADMIN"])`; hiding an action in the UI is only a convenience.

## First Admin bootstrap

No default credential is seeded. Set `STOCKFLOW_ADMIN_NAME`, `STOCKFLOW_ADMIN_EMAIL`, and `STOCKFLOW_ADMIN_PASSWORD` as process-only environment values, then run `npm run admin:bootstrap`. Remove the values immediately afterward.

The command uses the server/admin `DIRECT_URL`, validates and normalizes the input, hashes the password with Better Auth, and creates the User plus credential Account atomically. A PostgreSQL advisory transaction lock prevents concurrent bootstrap races. If any Admin exists, the command refuses replay. Further user-management UI is deferred.

## Role policy

- `ADMIN`: may view and mutate Phase 1B master data.
- `MANAGER` and `STAFF`: may view authenticated master-data screens; mutation permission remains denied until the business finalizes those policies.
- Future posting corrections, reversals, and unrestricted backdating remain reserved for Admin/Manager services and are not implemented in Phase 1B.
