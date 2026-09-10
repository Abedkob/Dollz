# Deploy Dollz with Dokploy

`compose.production.yml` is the production entry point. The existing
`docker-compose.yml` remains the local-development PostgreSQL service.

## 1. Prepare the release

1. Commit and push every application change and required public asset.
2. Run the release checks locally:

   ```bash
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm test:db
   docker compose -f compose.production.yml build api web
   ```

3. Decide how the existing catalog will reach production. A fresh database has
   no products. Either recreate the catalog in the admin UI after deployment,
   or restore a reviewed PostgreSQL dump together with the matching media
   directory. Database rows and media files must be transferred as one unit.

## 2. Create the Dokploy Compose service

1. Create a Docker Compose service from the Git repository.
2. Set the Compose path to `compose.production.yml`.
3. Copy the keys from `.env.production.example` into Dokploy's Environment
   editor and replace every placeholder.
4. Generate independent secrets. Hex output is URL-safe for the PostgreSQL
   connection string constructed by Compose:

   ```bash
   openssl rand -hex 32 # POSTGRES_PASSWORD
   openssl rand -hex 48 # JWT_ACCESS_SECRET
   openssl rand -hex 48 # JWT_REFRESH_SECRET
   ```

5. Set both `ALLOWED_ORIGINS` and `NEXT_PUBLIC_SITE_URL` to the final HTTPS
   origin with no trailing slash, for example `https://dollz.example.com`.
6. Add the production hostname to the Cloudflare Turnstile widget and set its
   production site and secret keys.

`NEXT_PUBLIC_*` values are build-time values. Changing them requires a rebuild,
not only a container restart.

## 3. Deploy and attach the domain

Deploy the Compose service. Startup is intentionally ordered:

1. PostgreSQL becomes healthy.
2. `migrate` applies all pending migrations and exits successfully.
3. The API starts and passes its database health check.
4. The web service starts and passes `/health`.

In Dokploy's Domains tab, attach the public domain only to service `web`, port
`3000`, and enable HTTPS. Do not attach domains to `api`, `postgres`, or
`migrate`; browser API traffic is proxied through the web application.

## 4. Create the Super Admin

There is no default administrator. Temporarily add these variables to the API
service environment:

```text
ADMIN_BOOTSTRAP_EMAIL=owner@example.com
ADMIN_BOOTSTRAP_PASSWORD=a-long-unique-password
ADMIN_BOOTSTRAP_FULL_NAME=Dollz Administrator
```

Open the API container terminal and run:

```bash
node apps/api/node_modules/tsx/dist/cli.mjs apps/api/src/modules/auth/bootstrap-cli.ts
```

After it succeeds, remove all three bootstrap variables and redeploy. The
command refuses to create a second active Super Admin.

## 5. Data and backups

The named volumes are:

- `dollz_postgres_data` — PostgreSQL data
- `dollz_media` — uploaded originals, optimized images, and thumbnails

Enable Dokploy volume backups for both volumes before accepting real orders.
Store backups outside the VPS and test a restore. A database-only backup is not
enough because media records refer to files in `dollz_media`.

## 6. Launch checklist

- `/health` returns HTTP 200 through the public domain.
- The homepage, collection, customizer, cart, and checkout load over HTTPS.
- `/admin` redirects to login when signed out.
- Turnstile login and checkout work on the final hostname.
- The production Super Admin can upload and retrieve a test image.
- A complete test order can be submitted and opened through its private link.
- Database and media backups have completed successfully.
- Only the `web` service is publicly routed.

The current order workflow uses manual payment verification. Email delivery,
payment-gateway automation, courier integration, and automatic refunds remain
separate operational integrations.

## Rollback

Application rollback is safe when the previous image is compatible with all
already-applied migrations. Never edit an applied migration. Before any schema
rollback, take database and media backups and review the matching `*.down.sql`
file. Do not automatically roll database migrations back during an application
deployment failure.
