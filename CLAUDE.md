# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Dollz is a TypeScript modular monolith for a custom-doll e-commerce platform: a protected Super Admin catalog plus an end-to-end guest order workflow (catalog validation, immutable snapshots, private token-based tracking, review revisions, quotations, manual payment verification, production/shipping, messages, audit history, notification outbox). The storefront cart and visual customizer are intentionally deferred — do not build them unprompted.

Customers do not have accounts. There is no default administrator, default password, public registration route, or password-recovery shortcut.

## Commands

```bash
pnpm install
pnpm dev              # API (3001) and web (3000) dev servers, in parallel
pnpm build            # build all workspace projects
pnpm typecheck        # tsc --noEmit across all workspace projects
pnpm lint             # eslint . --max-warnings=0
pnpm format           # prettier --write .
pnpm test             # vitest run, excludes packages/database/tests/**
pnpm test:db          # real PostgreSQL integration tests (packages/database)
pnpm db:migrate       # apply pending migrations
pnpm db:rollback      # roll back the latest migration
pnpm db:status        # show applied/pending/modified migrations
pnpm db:reset:test    # destructive reset, guarded to TEST_DATABASE_URL only
pnpm admin:create     # one-time Super Admin bootstrap from env vars (refuses a second account)
```

Database tests need Postgres running first: `docker compose up -d postgres`. The compose service creates both `dollz` and `dollz_test` via `docker/init-test-db.sql`; if an existing volume predates that script, recreate the volume or create `dollz_test` manually.

To run a single test file, invoke vitest directly, e.g. `pnpm exec vitest run apps/web/src/components/order-list.test.tsx` or, for database tests, `pnpm --filter @dollz/database exec vitest run tests/authentication.test.ts --config vitest.config.ts`.

There is no root vitest config: web component tests opt into jsdom per-file with a `// @vitest-environment jsdom` docblock, everything else runs in the default node environment. `packages/database/vitest.config.ts` runs its own tests with `fileParallelism: false` (they share one real database) and loads root `.env`.

## Architecture

Pnpm workspace (`apps/*`, `packages/*`), each project builds independently with its own `tsconfig.json` extending root `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, NodeNext).

- `apps/api` — Fastify process, the security boundary for everything. Owns Super Admin auth, catalog/order services, guest access, image storage/delivery.
- `apps/web` — Next.js App Router app. Renders the admin shell and product/order workbenches, and proxies API calls through same-origin route handlers — it holds no independent trust of its own.
- `packages/database` — `pg` Pool wrapper, transaction helper, and the migration runner/CLI. No ORM.
- `packages/validation` — shared Zod schemas used by both API and web.
- `packages/types` — shared TypeScript contracts.
- `storage/{orders,previews,products,variants,options}` — gitignored, persistent image originals/derivatives/uploads on disk under `STORAGE_ROOT`.

### API module pattern (`apps/api/src/modules/<name>/`)

Every module (`auth`, `catalog`, `media`, `orders`) follows the same shape, wired together in `apps/api/src/app.ts`:

- `errors.ts` — a module-specific `Error` subclass with a closed set of error codes, a public-message table (never leaks internals), and an `xErrorResponse(error)` mapper to `{ statusCode, body }`. `app.ts`'s central `setErrorHandler` dispatches on `instanceof` to pick the right mapper, falling back to the auth mapper for anything unrecognized.
- `service.ts` — business logic, talks to the pool/repository.
- `repository.ts` (where present) — SQL queries.
- `routes.ts` — Fastify route registration, taking the service and shared auth guards as arguments.
- `schemas.ts` / `validation.ts` — Zod request schemas.

New modules should follow this same file split rather than inlining logic into routes.

### Admin authentication and authorization

- Access/refresh JWTs live only in `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production), distinct secrets, issuer/audience checks, algorithm allowlist, database-backed session validation. Refresh tokens are stored only as SHA-256 hashes with rotation, reuse detection, family revocation, and absolute expiry.
- `createAuthGuards` (`apps/api/src/modules/auth/guards.ts`) exposes two preHandlers: `authenticate` (reads the access cookie, throws `AuthError('UNAUTHORIZED')`, attaches `request.adminPrincipal`) and `csrf` (skipped for GET/HEAD; verifies allowed origin/referer, then the `x-csrf-token` header against the session-bound token). State-changing routes need both.
- The Next.js `/admin/auth/*` and `/admin/api/[...path]` routes (`apps/web/src/app/admin/`) are a thin same-origin proxy to the Fastify API — Fastify remains the actual security boundary, the web app trusts nothing on its own.
- `apps/web/src/middleware.ts` gates `/admin/:path*`: it checks `GET /admin/auth/session` server-side, attempts one silent refresh on failure, forwards `Set-Cookie` headers via `getSetCookies` (`apps/web/src/lib/proxy.ts`), and redirects anonymous requests to `/admin/login?next=<sanitized-path>`. Tokens never reach JSON responses or browser storage.
- The in-memory login rate limiter (`apps/api/src/modules/auth/rate-limiter.ts`) is single-process; a shared store is required before horizontally scaling the API.

### Guest order tracking

Customers never authenticate with an account. `POST /orders` creates a 256-bit guest token (stored only as a hash) and returns a link `/orders/:orderNumber#token=...`. The tracking page (`apps/web/src/app/orders/[orderNumber]/page.tsx`) exchanges the URL fragment once, strips it from browser history, and thereafter uses a short-lived HttpOnly order session plus an in-memory CSRF token for mutations — order numbers alone never authorize access. Tracking responses set `noindex`, `nofollow`, `no-referrer`.

Order creation validates Turnstile, rate limits, Zod schemas, catalog state, currency, options, and conflicts, all inside one transaction; prices are taken only from active variants/option adjustments, never client-supplied. Every admin mutation on an order requires the current optimistic-concurrency version and rejects stale writes. Approval locks final integer prices, creates an immutable revision plus a manual payment request, and requires customer acceptance before payment verification proceeds. There is no payment gateway, courier integration, or email provider — typed events are appended to `notification_outbox` for a future delivery worker to consume.

### Catalog and media

Products are base doll designs; variants are purchasable physical sizes (e.g. 25 cm, 40 cm), not generated customization combinations. Options model customer choices, whose predefined values may carry validated colors, managed reference images, integer price adjustments, defaults, and compatibility conflicts. Editable catalog records use integer optimistic-concurrency versions; publication is rejected with structured field errors until variants, defaults, primary media, descriptions, option values, colors, and image references are all valid. Product deletion archives rather than hard-deletes.

Uploads (`apps/api/src/modules/media/storage-service.ts`) accept only JPEG/PNG/WebP whose declared MIME matches the decoded signature; Sharp normalizes orientation, strips metadata, enforces byte/pixel/dimension limits, and writes original/optimized/thumbnail WebP files under random server-generated keys. A failed DB write cleans up only the files that upload created. Public delivery (`/media/:fileId/:variant`, mirrored through `apps/web/src/app/media/[fileId]/[variant]/route.ts`) serves only optimized/thumbnail renditions of public, non-deleted records — originals and private files are never reachable there. Soft deletion is blocked while a file is still referenced.

### Database and migrations

`packages/database/migrations` holds paired `NNN_name.up.sql` / `NNN_name.down.sql` files, three-digit sequential version prefix. The runner (`packages/database/src/migration-runner.ts`, driven by `src/cli.ts`) orders by version, runs each inside a transaction, records a SHA-256 checksum per applied migration in `schema_migrations`, and takes a PostgreSQL advisory lock to serialize concurrent runners. A changed checksum on an already-applied migration is rejected — never edit an applied migration, always add a new one. No migration command drops or resets a development/production database; only `db:reset:test` is destructive, and it refuses to run unless the target URL differs from `DATABASE_URL` and its name contains `test`.

### Configuration

`apps/api/src/config/environment.ts` parses all runtime configuration with Zod at startup and fails fast with a readable validation error — there is no untyped `process.env` access elsewhere. `.env.example` documents every variable. Production rejects placeholder/short JWT secrets. `TEST_DATABASE_URL` is the only URL integration tests and `db:reset:test` will touch.
