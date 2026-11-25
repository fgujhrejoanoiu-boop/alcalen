# Cal.com April 14 snapshot setup

The [source snapshot](https://github.com/calcom/cal-test/commit/c0d105e7b395f91745fb4301f6575e85dc1e7d52) is `c0d105e7b395f91745fb4301f6575e85dc1e7d52`. The parentless import is `98ea574163c9ceb426a3b0ba608917eb318bf05a` on `cal-test-full`. It retains all 10,463 tracked source paths, including the enterprise workspaces and licenses. Two OAuth example values in `apps/web/calendso.yaml` were replaced with approved placeholders. The source tree and import tree differ only in that file.

The linked worktree is `/workspace/cal-test-full`. The separate cal.diy checkout remains at `/workspace/alcalen` on `main`, commit `8628446ea90a222cf90959066daccdf4e19d180d`.

## Toolchain and local services

Use Node 20.x and the checked-in Yarn 4.12.0 release. The tested toolchain is Node 20.20.2, Yarn 4.12.0 and Docker 29.9.2 on Linux. The dedicated services are PostgreSQL 18.7 and Redis 8.12.0.

| Service | Container | Loopback port | Storage |
| --- | --- | --- | --- |
| PostgreSQL, database `cal_test_db` | `cal-test-full-postgres` | `55432` | `cal-test-full-postgres-data` |
| Redis with TLS and password authentication | `cal-test-full-redis` | `56379` | Dedicated Redis volume |

The existing containers can be restarted with `docker start cal-test-full-postgres cal-test-full-redis`. For a new setup, use the official `postgres:18` image, a new volume mounted at `/var/lib/postgresql`, a generated password, and a protected environment file containing `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. Publish the container at `127.0.0.1:55432:5432`. Verify the connected database using `SELECT current_database(), current_user, current_setting('server_version');` before migrating. Keep that database and volume separate from cal.diy.

API v2 production mode uses TLS for its Redis queue connection. Use `redis:8`, a dedicated volume and a password. Configure a TLS listener and a certificate trusted for the loopback host in the connection URL. On this machine the Redis URL is stored in `/workspace/scratch/cal-test-runtime/redis.env` and the combined CA bundle is at `/workspace/scratch/cal-test-runtime/api-ca-bundle.pem`. Supply that public CA bundle in `NODE_EXTRA_CA_CERTS` before starting Node. Keep both services bound to loopback for local testing.

## Environment files

Copy `.env.example` to `.env`, `.env.appStore.example` to `.env.appStore`, and `apps/api/v2/.env.example` to `apps/api/v2/.env` if the destinations do not already exist. Set each file's permissions to 600. Verify Git ignores them. The tracked `packages/prisma/.env` symlink points to the ignored root file.

- Set `DATABASE_URL` and `DATABASE_DIRECT_URL` in the root to the isolated PostgreSQL connection on port 55432. Set the same `DATABASE_URL` in `.env.appStore`.
- Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32` and `CALENDSO_ENCRYPTION_KEY` with `openssl rand -base64 24`. The encryption setting is a 32-byte string. A separate service-account encryption key can use the same generation method.
- Set `NEXTAUTH_URL`, `NEXT_PUBLIC_WEBAPP_URL`, and `NEXT_PUBLIC_WEBSITE_URL` to `http://localhost:3000`. Set `NEXT_PUBLIC_EMBED_LIB_URL` to `http://localhost:3000/embed/embed.js`. Use `http://localhost:5555` for `NEXT_PUBLIC_API_V2_ROOT_URL` and `http://localhost:5555/api/v2` for `NEXT_PUBLIC_API_V2_URL`.
- For API v2, set `DATABASE_URL`, `DATABASE_DIRECT_URL`, `DATABASE_READ_URL`, and `DATABASE_WRITE_URL` to the same isolated database. Set `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY`, the service-account encryption key, and a freshly generated `JWT_SECRET`. Use `API_PORT=5555`, `API_URL=http://localhost:5555`, `WEB_APP_URL=http://localhost:3000`, and the authenticated `rediss://` URL. Keep `IS_E2E=false` for ordinary runtime checks.
- Set `CALCOM_TELEMETRY_DISABLED=1` and `NEXT_TELEMETRY_DISABLED=1` for local testing. Email delivery, calendar OAuth, Stripe billing, and background job integrations need their own configuration if used. A local email sink is sufficient for development email. Licensed features require a valid Cal.com entitlement, and the source licenses govern production use and distribution.

## Install, migrate, and build

Run from this worktree. On this machine, load `source /workspace/scratch/cal-test-runtime/activate.sh` to select the verified Node and Yarn and put npm and Yarn caches in writable paths. On a new machine, activate Yarn with Corepack or run `node .yarn/releases/yarn-4.12.0.cjs` in place of `yarn`. For this linked worktree, disable Husky installation to avoid altering hooks used by the cal.diy checkout.

```bash
cd /workspace/cal-test-full
export NODE_OPTIONS=--max-old-space-size=8192
HUSKY=0 yarn install --immutable
yarn prisma generate
yarn workspace @calcom/prisma db-deploy
yarn workspace @calcom/prisma prisma migrate status
yarn predev
yarn build --concurrency=2
yarn turbo run build --filter=@calcom/api... --concurrency=2
yarn turbo run build --filter=@calcom/api-v2... --concurrency=2
yarn workspace @calcom/atoms build-npm
yarn turbo run build --concurrency=2
```

The repository has 590 migration directories. After deploy, confirm that the Prisma migration history has finished entries and that `User`, `EventType`, `Schedule`, and `Booking` tables exist. Use the first-user wizard at `/auth/setup` on a clean database. For known demo data, the Prisma workspace provides `yarn workspace @calcom/prisma seed-basic`. Use that explicit script only for an isolated development fixture.

`yarn build` selects the web application and its dependencies. API v1, API v2 and Atoms have distinct build targets. Enterprise and routing forms code compiles through the workspaces that use it.

## Start and verify

After successful compilation, start the web app, API v1 and API v2 in separate terminals. The API v2 production entry requires its built dependencies and the Swagger module preparation from the API v2 workspace.

```bash
yarn workspace @calcom/web start --hostname 127.0.0.1 --port 3000
yarn workspace @calcom/api start --hostname 127.0.0.1
yarn workspace @calcom/api-v2 copy-swagger-module
NODE_EXTRA_CA_CERTS=/workspace/scratch/cal-test-runtime/api-ca-bundle.pem \
  yarn workspace @calcom/api-v2 start:prod
```

For development, run `yarn dev`. Expected local URLs are web `http://localhost:3000`, API v1 `http://localhost:3003/api`, and API v2 `http://localhost:5555/health`. A web smoke test should create a test account, an event type, and an availability schedule, then book, reschedule, and cancel an appointment. Confirm the records and session are persisted. Verify the public booking and App Store pages, and check licensed functionality only with a genuine entitlement.

## Verification and recovery

- The initial push was verified against the remote branch SHA. Both dedicated database services passed authenticated connection checks. Node and Yarn versions and the ignored environment files were verified.
- Immutable installation fetched and linked dependencies. The root postinstall, `yarn prisma generate`, `yarn workspace @calcom/prisma db-deploy`, and `yarn type-check:ci --force --concurrency=2` stopped when the cloud proxy denied the pinned engine checksum download from `binaries.prisma.sh` with HTTP 403. An authenticated SQL check confirmed `cal_test_db` has no Prisma migration table. A network draft proposes only this hostname.
- The first web build could not write npm's cache during the embed build. With a writable cache, the embed build completed and the pipeline stopped at Prisma's HTTP 403. All 13 lint tasks passed. The API v2 workspace's pinned Redis client passed an authenticated TLS ping.
- After the hostname is enabled, rerun `yarn install --immutable`, then generation, migration and compilation in that order. Keep engine checksum verification enabled. If using a read-only system home, assign writable Yarn and npm cache directories under the task runtime directory. Logs from this machine are under `/workspace/scratch/cal-test-runtime` and should be kept out of Git.
- Updates should be made on `cal-test-full`. Verify the target database, preserve the lockfile and setup secrets, and clear only generated outputs inside this worktree when needed. Keep the original cal.diy checkout and its database separate.

The two OpenAPI placeholders are the only customization carried forward from cal.diy. Its CI, README and Compose changes target the cal.diy layout. No project-specific branding or application behavior was found to transfer.
