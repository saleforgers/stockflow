# Authentication Foundation

Authentication implementation is deliberately deferred to Phase 1B. Phase 1A preserves the `UserRole` values `ADMIN`, `MANAGER`, and `STAFF`, validates a future `AUTH_SECRET` shape, and defines the following implementation boundary without creating insecure placeholder credentials or sessions.

## Phase 1B implementation

1. Select a maintained server-side authentication library compatible with the installed Next.js version and PostgreSQL/Prisma stack.
2. Use password hashes produced by a memory-hard password hashing algorithm with library-managed salts and reviewed parameters. Never store or log passwords.
3. Add persistent session storage, secure `HttpOnly`/`SameSite` cookies, rotation, expiry, logout invalidation, and CSRF-safe mutation patterns.
4. Create the first Admin through a one-time, explicit bootstrap command that requires credentials from secure input. Do not seed a default password.
5. Enforce active-user and role checks in server-side route/service boundaries. Client-side visibility is not authorization.
6. Reserve correction, reversal, and unrestricted backdating capabilities for Admin and Manager services.
7. Add tests for login failure, inactive users, session expiry, role denial, and first-admin bootstrap replay prevention.

No authentication dependency is installed in Phase 1A because choosing and configuring it must be completed as one secure vertical slice rather than as unused placeholder code.
