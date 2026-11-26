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

Some upstream CI jobs assume Blacksmith runners or secrets for publishing, production deployments, browser tests with external accounts, or SaaS services. Those are different from missing source. A standalone validation path can use GitHub-hosted runners, public packages, local PostgreSQL, and generated local credentials. The repository retains genuine entitlement checks and integration configuration for licensed or hosted features.

## Integration decision

**Strategy B.** Base `recovery/unified-working` on `archive-apr26-complete`. Starting with the complete workspace preserves the APIs, backend, enterprise implementations, schema, and migrations as a single tested unit. Transplanting thousands of paths into the public snapshot would require reversing its schema deletions, route changes, and partial service implementations. Bring forward independently compatible public bug fixes, tests, and portable CI improvements. Preserve the complete schema and dependency graph unless a specific verified update requires a change.

## Integration and verification log

Implementation and runtime checks are pending.
