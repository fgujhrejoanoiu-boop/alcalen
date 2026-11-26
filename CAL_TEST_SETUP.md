# Cal.com April 14 snapshot setup

The [source snapshot](https://github.com/calcom/cal-test/commit/c0d105e7b395f91745fb4301f6575e85dc1e7d52) is `c0d105e7b395f91745fb4301f6575e85dc1e7d52`. The parentless import is `98ea574163c9ceb426a3b0ba608917eb318bf05a` on `cal-test-full`. It retains all 10,463 tracked source paths, including the enterprise workspaces and licenses. Two OAuth example values in `apps/web/calendso.yaml` were replaced with approved placeholders. The source tree and import tree differ only in that file.

The linked worktree is `/workspace/cal-test-full`. The separate cal.diy checkout is at `/workspace/alcalen` at the `main` commit `8628446ea90a222cf90959066daccdf4e19d180d`.

## Toolchain and local services

Use Node 20.x and the checked-in Yarn 4.12.0 release. The tested toolchain is Node 20.20.2, Yarn 4.12.0 and Docker 29.9.2 on Linux. The dedicated services are PostgreSQL 18.7 and Redis 8.12.0.

| Service | Container | Loopback port | Storage |
| --- | --- | --- | --- |
| PostgreSQL, database `cal_test_db` | `cal-test-full-postgres` | `55432` | `cal-test-full-postgres-data` |
| Redis with TLS and password authentication | `cal-test-full-redis` | `56379` | `cal-test-full-redis-data` |

The existing containers can be restarted with `docker start cal-test-full-postgres cal-test-full-redis`. For a new setup, use the official `postgres:18` image, a new volume mounted at `/var/lib/postgresql`, a generated password, and a protected environment file containing `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. Publish the container at `127.0.0.1:55432:5432`. Verify the connected database using `SELECT current_database(), current_user, current_setting('server_version');` before migrating. Keep that database and volume separate from cal.diy.

API v2 production mode uses TLS for its Redis queue connection. Use `redis:8.12.0`, a dedicated volume and a password. Configure a TLS listener and a certificate trusted for the loopback host in the connection URL. Publish it at `127.0.0.1:56379:6379`. On this machine the Redis URL is stored in `/workspace/scratch/cal-test-runtime/redis.env` and the combined CA bundle is at `/workspace/scratch/cal-test-runtime/api-ca-bundle.pem`. Supply that public CA bundle in `NODE_EXTRA_CA_CERTS` before starting Node. Keep both services bound to loopback for local testing.

## Environment files

Copy `.env.example` to `.env`, `.env.appStore.example` to `.env.appStore`, and `apps/api/v2/.env.example` to `apps/api/v2/.env` if the destinations do not already exist. Set each file's permissions to 600. Verify Git ignores them. The tracked `packages/prisma/.env` symlink points to the ignored root file.

- Set `DATABASE_URL` and `DATABASE_DIRECT_URL` in the root to the isolated PostgreSQL connection on port 55432. Set the same `DATABASE_URL` in `.env.appStore`.
- Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32` and `CALENDSO_ENCRYPTION_KEY` with `openssl rand -base64 24`. The encryption setting is a 32-byte string. A separate service-account encryption key can use the same generation method.
- Set `NEXTAUTH_URL`, `NEXT_PUBLIC_WEBAPP_URL`, and `NEXT_PUBLIC_WEBSITE_URL` to `http://localhost:3000`. Set `NEXT_PUBLIC_EMBED_LIB_URL` to `http://localhost:3000/embed/embed.js` and `NEXT_PUBLIC_API_V2_URL` to `http://localhost:5555/api/v2`. Export `NEXT_PUBLIC_API_V2_ROOT_URL=http://localhost:5555` in the shell so the environment validator preserves the template structure.
- For API v2, set `DATABASE_URL`, `DATABASE_DIRECT_URL`, `DATABASE_READ_URL`, and `DATABASE_WRITE_URL` to the same isolated database. Set `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY`, the service-account encryption key, and a freshly generated `JWT_SECRET`. Use `API_PORT=5555`, `API_URL=http://localhost:5555`, `WEB_APP_URL=http://localhost:3000`, and the authenticated `rediss://` URL. Keep `IS_E2E=false` for ordinary runtime checks.
- Set `CALCOM_TELEMETRY_DISABLED=1` and `NEXT_TELEMETRY_DISABLED=1` for local testing. Email delivery, calendar OAuth, Stripe billing, and background job integrations need their own configuration if used. A local email sink is sufficient for development email. Licensed features require a valid Cal.com entitlement, and the source licenses govern production use and distribution.

## Install, migrate, and build

Run from this worktree. On this machine, load `source /workspace/scratch/cal-test-runtime/activate.sh` to select the verified Node and Yarn and put npm and Yarn caches in writable paths. On a new machine, activate Yarn with Corepack or run `node .yarn/releases/yarn-4.12.0.cjs` in place of `yarn`. For this linked worktree, disable Husky installation to avoid altering hooks used by the cal.diy checkout.

```bash
cd /workspace/cal-test-full
source /workspace/scratch/cal-test-runtime/activate.sh
export NODE_OPTIONS=--max-old-space-size=16384
export npm_config_cache=/tmp/.npm
export NEXT_PUBLIC_API_V2_ROOT_URL=http://localhost:5555
HUSKY=0 yarn install --immutable
yarn prisma generate
yarn workspace @calcom/prisma db-deploy
yarn workspace @calcom/prisma prisma migrate status
yarn predev
yarn env-check:common
yarn env-check:app-store
yarn build --concurrency=2
yarn type-check:ci --force --concurrency=2
node --env-file=.env .yarn/releases/yarn-4.12.0.cjs workspace @calcom/api build
yarn workspace @calcom/platform-libraries build
yarn workspace @calcom/api-v2 copy-swagger-module
yarn workspace @calcom/api-v2 build
```

The repository has 590 migration directories. After deploy, confirm that the Prisma migration history has 590 finished entries, that no entries failed or rolled back, and that `users`, `EventType`, `Schedule`, `Booking`, `Team`, and `Workflow` exist. The Prisma `User` model maps to the `users` table. Use the first-user wizard at `/auth/setup` on a clean database. For known demo data in the isolated database, use `yarn workspace @calcom/prisma seed-basic`.

```bash
docker exec -i cal-test-full-postgres sh -ec \
  'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1' <<'SQL'
SELECT current_database();
SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied,
       count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS failed,
       count(*) FILTER (WHERE rolled_back_at IS NOT NULL) AS rolled_back
FROM public._prisma_migrations;
SELECT name, to_regclass(format('public.%I', name)) IS NOT NULL AS present
FROM (VALUES ('users'), ('EventType'), ('Schedule'), ('Booking'), ('Team'), ('Workflow')) AS expected(name);
SQL
```

`yarn build` compiles the web application and its dependencies. API v1 has its own Next.js build. API v2 uses the platform library build to resolve the generated PBAC types and the Swagger copy command to make the Nest plugin available. The writable npm cache is used by the embed build. Set the Node memory limit to suit the machine when running these commands elsewhere.

## Start and verify

After successful compilation, start the web app, API v1 and API v2 in separate terminals. The API v2 production entry requires its built dependencies and the Swagger module preparation from the API v2 workspace.

```bash
yarn workspace @calcom/web start --hostname 127.0.0.1 --port 3000
node --env-file=.env .yarn/releases/yarn-4.12.0.cjs workspace @calcom/api start --hostname 127.0.0.1
yarn workspace @calcom/api-v2 copy-swagger-module
NODE_ENV=production NODE_EXTRA_CA_CERTS=/workspace/scratch/cal-test-runtime/api-ca-bundle.pem \
  yarn workspace @calcom/api-v2 start:prod
```

For development, run `yarn dev`. For production smoke tests, check Web `/` and `/auth/login` on port `3000`, API v1 `/api/v1/docs` on port `3003`, and API v2 `/health` on port `5555`. Sign in to Web with the isolated test account and confirm the session identifies it. Create a schedule and event type, fetch public availability, reserve a returned slot, and verify an accepted booking row in `cal_test_db`.

The current runtime's smoke helper is `/workspace/scratch/cal-test-runtime/smoke-web.py`. Run it with `python3 /workspace/scratch/cal-test-runtime/smoke-web.py web api-v1 api-v2 booking` after the three servers start. On its first run, it creates the first user in an empty `cal_test_db` and saves the local fixture under the runtime directory with mode `0600`. It keeps test credentials out of command output. Stop the three app servers after validation. PostgreSQL and Redis can stay running for the next local test.

## Verification and recovery

- PostgreSQL 18.7 passed authenticated SQL. Redis 8.12.0 passed authenticated `PING` with certificate validation over TLS 1.3. All three local environment files were ignored by Git and had mode `0600`.
- The published network policy allowed the official Prisma engine and checksum download from `binaries.prisma.sh`. Immutable install, postinstall, Prisma generation, and migration deployment passed. All 590 migration directory names matched completed entries in `cal_test_db`.
- The Web build completed all 13 tasks, and the forced CI type-check completed all 10 tasks. Turbo forwards the writable npm cache and proxy settings for the embed build. Web loads the checked-in Inter variable font for builds on networks that deny Google Fonts.
- API v1 generated a production `.next/BUILD_ID` and served public OpenAPI over HTTP. The OpenAPI generator logged non-fatal YAML annotation warnings. The protected event-types endpoint requires a Cal.com license. API v2 built its production entry point, connected to the isolated database and Redis, and returned HTTP 200 from `/health`.
- The compiled Web application passed the login, authenticated session, schedule, event type, availability, and booking checks. The booking response matched an accepted row in `cal_test_db`. Three representative unit test files passed with 48 tests passed and one marked todo.
- Local logs are under `/workspace/scratch/cal-test-runtime`. Keep them and the runtime credential files out of Git.
- Updates should be made on `cal-test-full`. Verify the target database, preserve the lockfile and setup secrets, and clear only generated outputs inside this worktree when needed. Keep the original cal.diy checkout and its database separate.

The two OpenAPI placeholders are the only customization carried forward from cal.diy. Its CI, README and Compose changes target the cal.diy layout. No project-specific branding or application behavior was found to transfer.
