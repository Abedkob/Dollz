# Dollz

Dollz is a TypeScript modular monolith for a custom-doll e-commerce platform. It includes the protected Super Admin catalog and an end-to-end guest order workflow: authoritative catalog validation, immutable snapshots, private token-based tracking, review revisions, final quotations, manual payment verification, production, shipping, messages, audit history, and notification outbox records. The storefront cart and visual customizer remain intentionally deferred.

## Architecture

- `apps/web` — Next.js App Router application with the protected admin shell, product and order workbenches, guest tracking foundation, and same-origin API/media proxies.
- `apps/api` — Fastify process with the Super Admin security boundary, catalog/order services, guest access boundary, and managed image delivery.
- `packages/database` — `pg` connection helpers, transaction helper, migration runner, SQL migrations, and PostgreSQL integration tests.
- `packages/validation` — shared Zod validation primitives.
- `packages/types` — shared TypeScript contracts.
- `storage` — ignored persistent image originals, optimized WebP renditions, thumbnails, and upload staging files.

Customers do not have accounts. Order tracking uses hashed guest access tokens and short-lived order-scoped sessions. No default administrator, default password, public registration route, or password-recovery shortcut is created.

## Orders

`POST /orders` accepts future storefront submissions after Turnstile, rate-limit, Zod, catalog, currency, option, and conflict validation. Prices come only from active variants and option adjustments. Creation is transactional and uses a hashed submission key, PostgreSQL sequence order number, immutable item/selection snapshots, customer-visible history, a 256-bit guest token stored only as a hash, audit activity, and outbox events.

Guest links use `/orders/:orderNumber#token=...`. `POST /orders/access/exchange` swaps the fragment token once for a short-lived, `HttpOnly`, `SameSite=Strict` order session cookie scoped to `/orders` plus an in-memory CSRF token; the tracking page then removes the fragment from browser history. Order numbers alone never authorize access, guests may revoke their own session (`POST /orders/:orderNumber/access/revoke`), and admins can revoke and reissue a fresh 90-day token (`POST /admin/orders/:orderId/access/regenerate`). Tracking pages send `noindex`, `nofollow`, and `no-referrer` policies.

Orders move through `SUBMITTED → UNDER_REVIEW → CHANGES_REQUESTED → UNDER_REVIEW → AWAITING_PAYMENT → PAID → IN_PRODUCTION → READY → SHIPPED → DELIVERED`, with `REJECTED` and `CANCELLED` reachable from most pre-delivery states. The protected `/admin/orders` workbench supports bounded search/filter/sort/pagination and a state-specific detail workflow. All admin mutations require the current order version and reject stale changes.

An admin can request changes on an order under review, which raises a `CHANGES_REQUESTED` revision with per-item messages and returns the order to the customer. The customer replies on the guest tracking page: resubmitting new option selections for the affected items (re-validated against the live catalog, recorded as a `CUSTOMER_RESUBMISSION` revision, returning the order to `UNDER_REVIEW`) or asking for clarification. Approval locks final integer prices per item plus a delivery fee, creates an immutable `APPROVAL` revision and a manual payment request, and requires the customer to accept the quotation on the tracking page (declining cancels the order) before payment verification is possible. Both sides can exchange threaded messages on an order (`GET`/`POST /orders/:orderNumber/messages` for the guest, `POST /admin/orders/:orderId/messages` for the admin), and admins can additionally leave order-scoped internal notes (`POST /admin/orders/:orderId/internal-notes`) that customers never see. No payment gateway, customer account, automatic refund, courier integration, or email provider is selected; typed events remain in `notification_outbox` for a future delivery worker.

## Prerequisites

- Node.js 22 or newer
- pnpm 10
- Docker with Docker Compose, or PostgreSQL 15+ available locally

## Installation

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm admin:create
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

The Compose service exposes PostgreSQL on port 5432 and creates both `dollz` and `dollz_test`. If a previously created volume predates the test-database initialization script, remove that development volume intentionally or create `dollz_test` manually.

Create the one Super Admin from environment variables in the shell that runs the command. The command refuses to create a second account and never accepts a password as a command-line argument:

```powershell
$env:ADMIN_BOOTSTRAP_EMAIL = "admin@example.com"
$env:ADMIN_BOOTSTRAP_PASSWORD = "use-a-long-unique-password"
$env:ADMIN_BOOTSTRAP_FULL_NAME = "Dollz Administrator" # optional
pnpm admin:create
Remove-Item Env:ADMIN_BOOTSTRAP_EMAIL, Env:ADMIN_BOOTSTRAP_PASSWORD, Env:ADMIN_BOOTSTRAP_FULL_NAME
```

## Environment

`.env.example` documents all required values. Runtime configuration is parsed with Zod and fails with a readable validation error. Do not commit `.env` or credentials.

- `DATABASE_URL` is used by development/production commands and the API.
- `TEST_DATABASE_URL` is the only URL accepted by integration tests and test reset.
- `db:reset:test` refuses a URL equal to `DATABASE_URL` and requires the database name to contain `test`.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be separate random secrets. Production rejects placeholder or short values.
- `TURNSTILE_SECRET_KEY` stays server-only. Only `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is exposed to the browser.
- `ALLOWED_ORIGINS` is the explicit comma-separated origin allowlist. Set `TRUST_PROXY=true` only behind a trusted reverse proxy.
- `STORAGE_ROOT` is the persistent filesystem root. Image byte, pixel, dimension, optimized-width, and thumbnail-width limits are independently configurable.

No migration command automatically drops or resets a development or production database.

## Commands

```bash
pnpm dev              # API and web development servers
pnpm build            # build all workspace projects
pnpm typecheck        # TypeScript validation
pnpm lint             # ESLint
pnpm test             # non-database unit tests
pnpm test:db          # real PostgreSQL integration tests
pnpm db:migrate       # apply pending migrations
pnpm db:rollback      # roll back the latest migration
pnpm db:status        # show applied/pending/modified migrations
pnpm db:reset:test    # destructive reset, guarded for test DB only
pnpm admin:create     # one-time Super Admin bootstrap from environment
```

The API defaults to `http://localhost:3001`; the web application defaults to `http://localhost:3000`.

## Admin authentication

The browser receives short-lived access and rotating refresh JWTs only as `HttpOnly`, `SameSite=Lax` cookies (`Secure` in production). JWTs use distinct secrets, issuer/audience checks, an algorithm allowlist, and database-backed session validation. Refresh tokens are stored only as SHA-256 hashes; rotation, reuse detection, family revocation, absolute expiry, logout, password change, disabled accounts, and account lockout are enforced by the API.

State-changing authenticated requests require the session-bound CSRF token from `GET /admin/auth/session` in the `x-csrf-token` header. Login requires Cloudflare Turnstile and separate normalized-email and client-IP rate limits. Origin checks are enforced for cookie-issuing and state-changing routes.

The authentication endpoints are:

- `POST /admin/auth/login`
- `POST /admin/auth/refresh`
- `POST /admin/auth/logout`
- `POST /admin/auth/change-password`
- `GET /admin/auth/session`

The Next.js `/admin/auth/*` handlers are a same-origin browser proxy; Fastify remains the security boundary. Middleware validates sessions server-side, attempts one refresh for an expired access cookie, and redirects anonymous requests to `/admin/login` with a sanitized internal `next` path. Tokens are never returned in JSON or written to browser storage.

## Catalog and media

Products are base doll designs. Product variants are purchasable physical versions such as 25 cm and 40 cm—not generated combinations of customization choices. Options model customer choices, and predefined option values may include validated colors, managed reference images, integer price adjustments, controlled metadata, defaults, and compatibility conflicts. Common option types (eye color, hair color, skin tone, outfit color) can be created in one step from built-in presets (`POST /admin/products/:productId/options/presets/:presetCode`) with values pre-populated. Options may be flagged `affects3d` with a `threeDProperty` (`eyes`, `hair`, `dress`, or `dressName`) so their choices map onto a future 3D preview; this metadata is validated at publish time even though no 3D renderer or storefront customizer exists yet. An option code still referenced by past order snapshots is preserved and cannot be edited or removed, to keep order history accurate.

The product workbench lives at `/admin/products`; `/admin/media` manages reusable product, variant, and option images. All catalog reads require an active Super Admin session, and all mutations additionally require the session-bound CSRF token. Normal product deletion archives records. Editable catalog records use integer optimistic-concurrency versions, and publication is rejected with structured field errors (`GET /admin/products/:productId/publishing-checklist` returns the same checks ahead of time) until variants, defaults, primary media, descriptions, option values, colors, and image references are valid.

Uploads accept only decoded JPEG, PNG, and WebP data whose declared MIME matches its signature. Sharp normalizes orientation, strips metadata, enforces encoded/decode limits, and produces normalized original, optimized, and thumbnail WebP files under random server-generated keys. Database failures remove only files created by that upload. Public delivery at `/media/:fileId/:variant` exposes only optimized or thumbnail renditions of public, non-deleted records; original and private files are never served there. Soft deletion is blocked while a file is referenced.

## Migrations

Migrations live in `packages/database/migrations` as matching versioned `*.up.sql` and `*.down.sql` files. To create the next migration, add both files using the next three-digit version, for example:

```text
014_example.up.sql
014_example.down.sql
```

The runner orders migrations by version, executes each inside a transaction, records its SHA-256 checksum in `schema_migrations`, and uses a PostgreSQL advisory lock to serialize runners. Never edit an applied migration: create a new one. A changed applied checksum is rejected.

## Testing

Start PostgreSQL and copy the example environment before running tests:

```bash
docker compose up -d postgres
pnpm test:db
```

Database tests are not mocked or silently skipped. They rebuild only the database named by `TEST_DATABASE_URL`, verify that it is distinct from `DATABASE_URL`, exercise all migrations and constraints, and cover authentication plus protected catalog creation, publishing rejection/success, search/filtering, optimistic concurrency, file-reference conflicts, unpublishing, and archive preservation. Unit and frontend tests cover image signatures/decoding/derivatives/cleanup, shared validation, product-list states, form errors, media selection, and variant mutations. Database suites clean up the public schema and close their pool. An unavailable or incorrectly configured server produces a setup error with the command above.

## Folder tree

```text
apps/
  api/src/{config,modules/auth,modules/catalog,modules/media,modules/orders,plugins}/
  web/src/{app/admin,app/media,components,lib}/
packages/
  database/{migrations,src,tests}/
  types/src/
  validation/src/
storage/{orders,previews,products,variants,options}/
docker/
```

The refresh cookie uses path `/` so Next.js middleware can refresh before allowing any protected `/admin` route; it remains `HttpOnly`, same-site, and production-secure. The in-memory request limiter is intentionally single-process. A shared limiter is required before horizontally scaling the API.
