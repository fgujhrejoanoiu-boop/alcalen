# Alcalen standalone recovery

## Starting points

| Snapshot | Local archive tag | Commit |
| --- | --- | --- |
| Complete pre-split code and verified local build | `archive-apr26-complete` | `a33182aeb586f42234ad27c07c1e6f0f72940950` |
| Later public cal.diy snapshot | `archive-main-public-broken` | `8628446ea90a222cf90959066daccdf4e19d180d` |

The commits have independent Git histories. The comparison uses the trees at these commits and makes no assumption about chronology beyond the two captured snapshots.

## Structural audit

`git diff --name-status origin/cal-test-full origin/main` reports 4,298 changes with rename detection. Turning rename detection off gives 3,062 complete-only paths, 311 public-only paths, and 1,149 modified paths. Many detected renames are the public API v2 reorganizing files into its platform subtree. The public tree removes 423,041 lines in total and adds 31,591.

| Complete implementation | Complete-only scope or public change |
| --- | --- |
| `apps/api/v1` | Entire workspace absent from public snapshot, including booking, event types, scheduling, auth and licensing, rate limiting, and its tests. |
| `apps/api/v2/src` | Public tree retains platform routes, without most organization, team, billing and workflow modules. The complete tree has 986 API v2 paths, versus 638 in the public tree. |
| `packages/features/ee`, `apps/web/modules/ee` | Complete enterprise services and web modules for billing, teams, organizations, workflow reminders, delegation and related settings. |
| `packages/app-store/routing-forms`, `packages/features/routing-forms`, `packages/features/routing-trace` | Routing forms app, routes, persistence, assignment traces and integration. |
| `packages/trpc/server/routers/viewer/{teams,organizations,workflows}`, `packages/trpc/server/routers/apps/routing-forms` | Complete router inputs, permissions, handlers, tests, and registration points. |
| `apps/web/app/api/auth`, `apps/web/app/api/cron` | Complete SAML/OIDC entry points and scheduled enterprise work. |
| `packages/features/bookings`, `packages/features/calAIPhone`, `packages/features/tasker` | Complete booking, provider, and job integration paths. |

The public API v2 still exposes some platform paths with reduced behavior. For example, round-robin slot validation unconditionally accepts, reassignment operations are empty, and some credential, organization user and verification operations throw or return a constant. The complete tree has implementations and enterprise authorization for these features. Keep complete callers and their implementations together.

The exact path inventories are reproducible from the archive tags, with no dependency on this workspace or an external repository.

```bash
git diff --name-status archive-apr26-complete archive-main-public-broken
git diff --no-renames --diff-filter=D --name-only archive-apr26-complete archive-main-public-broken
git diff --name-status archive-apr26-complete archive-main-public-broken -- packages/prisma/migrations
git diff archive-apr26-complete archive-main-public-broken -- packages/prisma/schema.prisma
```

## Toolchain and schema

| Component | Complete snapshot | Public snapshot |
| --- | --- | --- |
| CI Node | 20.x | 22.x |
| Yarn | 4.12.0, checked in, node-modules linker | Same |
| Turbo | 2.7.1 | Same |
| Web Next.js / React | 16.1.5 / 18.2.0 | 16.4.3 / 18.2.0 |
| API v1 Next.js | 16.1.5 | Workspace absent |
| API v2 Nest | 10.4.20 | 10.4.20 |
| tRPC | 11.0.0-next-beta.222 | Same |
| Prisma CLI and client | 6.16.1 | Same |
| TypeScript | 5.9.3 | Same |
| Vitest | 4.0.16 | 4.1.8 |
| Matched Yarn workspaces | 115 | 113 |

The complete schema has 119 models, 54 enums, and three views. The public schema has 100 models, 46 enums, and two views. Entire removed models cover routing forms, responses and assignment traces, domain-wide delegation, impersonations, workflows, reminders, translations, and AI phone-call configuration. Common models such as `Booking`, `EventType`, `Team`, `User`, and calendar relations also lose fields. This is a schema and application boundary even though the Prisma and tRPC versions match.

All 590 shared migration SQL files match exactly. Five public-only migrations remove routing forms, workflow tables, impersonations, domain-wide delegation, and the instant-meeting webhook trigger. Their directories are:

- `20260305043434_remove_routing_forms`
- `20260319000000_drop_workflow_tables`
- `20260319100000_drop_impersonations_table`
- `20260319161640_drop_domain_wide_delegation`
- `20260430000000_drop_instant_meeting_webhook_trigger`

Recovery validation uses a new database. An existing database that applied these drops requires a backup-based data recovery and migration reconciliation before deployment.

## Source dependencies and CI

Both trees contain zero Git submodules, Gitlinks, private npm registry declarations, unresolved manifest-declared workspaces, or Git/tarball package resolutions. The Yarn locks use `npm:`, `workspace:`, and `patch:`. The API v1 package's `git@github.com:calcom/api.git` repository field is legacy metadata. It does not participate in dependency resolution.

Some upstream CI jobs assume Blacksmith runners or secrets for publishing, production deployments, browser tests with external accounts, or SaaS services. A standalone validation path uses GitHub-hosted runners, public packages, local PostgreSQL, and generated local credentials. The licensed service path can use `CALCOM_PRIVATE_API_ROUTE`, whose inherited hosted default is `https://goblin.cal.com`. Local build, startup, and booking validation passed independently of that service.

The complete snapshot carries its original root AGPL license and commercial licenses in `packages/features/ee` and `apps/api/v2/src/ee`. Those licenses remain in effect for the recovered code. The later public tree's MIT license applies to its public source and does not change the license of the complete baseline.

## Integration decision

**Strategy B.** Base `recovery/unified-working` on `archive-apr26-complete`. Starting with the complete workspace preserves the APIs, backend, enterprise implementations, schema, and migrations as a single tested unit. Transplanting thousands of paths into the public snapshot would require reversing its schema deletions, route changes, and partial service implementations. Bring forward independently compatible public bug fixes, tests, and portable CI improvements. Preserve the complete schema and dependency graph unless a specific verified update requires a change.

## Integrated changes

- Ported Node 22 for standalone CI and Next.js 16.4.3 for Web and the platform example. Applied the same Next.js version to the restored API v1 workspace and regenerated the lockfile.
- Ported header IP whitespace normalization and empty-array handling in `packages/lib/getIP.ts`. Proxy header precedence stays the same.
- Ported normalization for `BLACKLISTED_GUEST_EMAILS` in `packages/lib/getBlacklistedGuestEmails.ts`, including whitespace, address case, and plus tags. Applied it to individual booking validation, regular-booking guests, the public email verification check, and the authenticated add-guests handler. These handlers retain the complete snapshot's authorization, account settings, and verification flow.
- Added `America/Coyhaique` to `packages/lib/timeZones.ts` and carried over focused regression coverage for the three utility changes.
- Replaced the obsolete API v1 repository metadata URL with the Alcalen repository and its local workspace path. Repaired the YAML annotation for the bookings list API, including the `order` query parameter in the generated OpenAPI document.
- Added a GitHub-hosted standalone workflow with checked-in Yarn, immutable install, isolated PostgreSQL, generated local test credentials, and build and validation jobs. `ENABLE_HOSTED_CI=true` enables the configured same-repository legacy PR and cache jobs. `ENABLE_HOSTED_AUTOMATION=true` enables configured deployment, translation, reporting, performance, and publishing jobs. These jobs need their own credentials. The standalone workflow uses neither opt-in.
- Fixed the availability service's initialization order so its cache wrapper gets the injected Redis client after the dependencies are available. The platform declaration build no longer reports the use-before-initialization error.
- Made test discovery skip generated Next.js output. Reroute assertions now use the configured site origin and report failures synchronously. PostgreSQL fixture setup rolls back on failure, cleans up its own records, and derives profile IDs from seeded users.
- Restored cached availability invalidation for the Atoms booker and made the browser bundle resolve `node:process` through a public browser shim. The platform example uses its own generated SQLite client, supported Atoms props, and local Inter and Poppins files. Its Poppins assets carry the SIL Open Font License.

The pre-split implementation paths listed in the structural audit are present through the complete base, including their source, registrations, and tests. They were brought in together through ancestry. The recovered schema and the SQL migration chain match the complete archive.

## Local verification setup

Use Node 22 and the checked-in Yarn 4.12.0. From the recovery worktree, run the root `yarn` commands with the bundled release on PATH. In the current cloud workspace, `source /workspace/scratch/alcalen-recovery/activate.sh` selects the toolchain and writable caches. On another machine, activate the pinned release with Corepack or use a PATH wrapper for `node .yarn/releases/yarn-4.12.0.cjs`.

- The recovery PostgreSQL 18.7 service is `alcalen-recovery-postgres` on `127.0.0.1:56432`, with database `alcalen_recovery`. The final integration run uses its own seeded `alcalen_recovery_integration_final` database in this recovery-only instance.
- The recovery Redis 8.12.0 service is `alcalen-recovery-redis` on `127.0.0.1:57379`, with authenticated TLS. API v2 uses a trusted certificate for the hostname in `REDIS_URL`.
- Copy the example environment files to ignored `.env`, `.env.appStore`, and `apps/api/v2/.env` files. Configure `DATABASE_URL` and `DATABASE_DIRECT_URL` for the new recovery database. Give API v2 the same database as both `DATABASE_READ_URL` and `DATABASE_WRITE_URL`, and set its `REDIS_URL` to the local authenticated TLS listener. Generate local `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY`, and `CALCOM_SERVICE_ACCOUNT_ENCRYPTION_KEY` values shared by the Web and API v2 apps. Use separate local generated values for `CRON_API_KEY` and API v2's `JWT_SECRET`.
- Use Web origin `http://localhost:3000`, API v1 port `3003`, and API v2 origin `http://localhost:5555`. Set the app URLs in the example files accordingly, and export `NEXT_PUBLIC_API_V2_ROOT_URL=http://localhost:5555`.
- Use a writable `npm_config_cache` for the embed build, and adjust the Node heap limit and Turbo concurrency to fit the available memory. In a linked worktree use `HUSKY=0` for install so the shared Git configuration stays intact.

```bash
docker start alcalen-recovery-postgres alcalen-recovery-redis
export npm_config_cache="${npm_config_cache:-${TMPDIR:-/tmp}/alcalen-npm-cache}"
mkdir -p "$npm_config_cache"
yarn --version
yarn install --immutable
yarn prisma validate
yarn prisma generate
yarn workspace @calcom/prisma db-deploy
yarn workspace @calcom/prisma prisma migrate status
yarn lint
yarn type-check:ci --force --concurrency=2
yarn build --concurrency=2
node --env-file=.env .yarn/releases/yarn-4.12.0.cjs workspace @calcom/api build
yarn workspace @calcom/platform-libraries build
yarn workspace @calcom/api-v2 copy-swagger-module
yarn workspace @calcom/api-v2 build
```

For the aggregate build, prepare the optional example's Atoms bundle and the API v2 Swagger plugin first:

```bash
yarn workspace @calcom/atoms build-npm
yarn workspace @calcom/api-v2 copy-swagger-module
node --env-file=.env .yarn/releases/yarn-4.12.0.cjs turbo run build --concurrency=2
```

Start the compiled servers in separate terminals. Set `NODE_EXTRA_CA_CERTS` for API v2 to the public CA bundle that trusts your local Redis certificate.

```bash
yarn workspace @calcom/web start --hostname 127.0.0.1 --port 3000
node --env-file=.env .yarn/releases/yarn-4.12.0.cjs workspace @calcom/api start --hostname 127.0.0.1
NODE_ENV=production NODE_EXTRA_CA_CERTS=/workspace/scratch/alcalen-recovery/api-ca-bundle.pem \
  yarn workspace @calcom/api-v2 start:prod
```

Use `yarn test --maxWorkers=2 --passWithNoTests=false` for the default root unit suite. For PostgreSQL integration tests, set `DATABASE_URL` and `DATABASE_DIRECT_URL` to a fresh fixture database, deploy the Prisma migrations there, run `yarn workspace @calcom/prisma db-seed`, and use `INTEGRATION_TESTS=true VITEST_MODE=integration yarn test --maxWorkers=1 --passWithNoTests=false`. Never point the fixture runner at a production or shared development database. For the API v2 Jest suite, supply the fixture database and local Redis environment as appropriate and run `yarn workspace @calcom/api-v2 exec jest --runInBand`.

## Verification log

| Check | Local result |
| --- | --- |
| `yarn install --immutable` | Passed with Node 22.23.5 and Yarn 4.12.0. Existing peer-dependency warnings remain. |
| `yarn prisma validate`, `yarn prisma generate` | Valid schema and all four generators passed. |
| `yarn workspace @calcom/prisma db-deploy`, `yarn workspace @calcom/prisma prisma migrate status` | Passed on fresh PostgreSQL. All 590 applied migration names match the repository, with no failed or rolled-back rows. SQL verified the users, event, booking, team, workflow, routing form, domain-wide delegation, and impersonation tables. |
| `yarn lint`, `yarn type-check:ci --force --concurrency=2` | Passed 13 lint and 10 type-check tasks. |
| `yarn build --concurrency=2` | Passed 13 Web production build tasks. |
| `node --env-file=.env .yarn/releases/yarn-4.12.0.cjs turbo run build --concurrency=2` | Passed all 19 aggregate build tasks, including Web, both APIs, and both examples. |
| API v1 and API v2 production build commands above | Both emitted production artifacts. The final platform library declaration build passed without the earlier TypeScript diagnostic. |
| `yarn test --maxWorkers=2 --passWithNoTests=false` | Passed 6,830 tests. 66 were skipped and 6 were marked todo. 632 test files passed and 7 were skipped. |
| `yarn workspace @calcom/api-v2 exec jest --runInBand` | Passed 312 tests in 22 suites with the isolated fixtures. |
| `INTEGRATION_TESTS=true VITEST_MODE=integration yarn test --maxWorkers=1 --passWithNoTests=false` | Passed 461 tests, with 4 skipped, on the separately migrated and seeded fixture database. 50 test files passed and 1 was skipped. |
| `TZ=America/Los_Angeles VITEST_MODE=timezone yarn vitest run --maxWorkers=1 --passWithNoTests=false` | Passed 62 tests, with 2 skipped, across 4 files. |
| `yarn workspace @calcom/atoms build-npm`, then `yarn workspace @calcom/base build` | Both commands exited 0. The example passed Next.js TypeScript checks, generated 16 pages, served `/` with HTTP 200, and returned the expected empty users response from its initialized SQLite fixture. The optional Atoms declaration generator still emits diagnostics. |
| Credential-sync example `yarn workspace @calcom/example-app-credential-sync build` | Compiled and emitted its production build ID. |
| `python3 /workspace/scratch/alcalen-recovery/smoke-web.py web api-v1 api-v2 booking` | Passed Web routes, sign-in and session, schedule and event type, available slots, and an accepted booking confirmed by SQL. API v1 served the public OpenAPI bookings operation. API v2 `/health` returned HTTP 200. |
| Standalone and changed hosted workflow YAML | Actionlint and shell syntax checks passed. GitHub-hosted execution was not part of the local run. |

## Deployment limits

Protected API v1 and licensed features retain their Cal.com entitlement requirements. The local smoke test had no license and verified the protected endpoint's license gate. A live deployment may also need configured OAuth, billing, mail, calendar or other integration credentials. Each service uses its actual provider configuration when enabled.

Some inherited convenience scripts target workspaces missing from both source snapshots, including `@calcom/ai`, `@calcom/console`, `@calcom/swagger`, and `@calcom/website`. The recovered Web and API build targets above have no dependency on those workspaces. The later public-only replacement docs app and schema deletions were left out of the recovery.

The Atoms Vite bundle and consuming example build and run locally. The optional SDK publication declaration pass still reports pre-existing compiler selection and wrapper-interface drift. A strict scratch check limited to reachable production sources and using the Web decorator and alias settings found 22 diagnostics, mostly in Atoms wrappers. Clean SDK declaration publication has separate work remaining. The workspace CI type-check excludes that publication-only pass.

## Review and promote

The recovery branch keeps the complete tree as its first-parent history. Its final integration merge records the archived public commit as a second parent while retaining the audited recovery tree. That gives `main` a fast-forward path from the reviewed public snapshot. The two archive tags are local safety references. The source commits are also reachable through the recovery branch history.

```bash
git fetch origin
git log --graph --oneline origin/main..origin/recovery/unified-working
git diff --stat origin/main origin/recovery/unified-working
git diff origin/main origin/recovery/unified-working
```

After review, promote from a clean `main` worktree with normal branch permissions:

```bash
git switch main
git merge --ff-only origin/recovery/unified-working
git push origin main
```

The fast-forward check stops if `main` advanced independently. Review the database migration plan separately if the instance previously applied the public snapshot's destructive migrations.
