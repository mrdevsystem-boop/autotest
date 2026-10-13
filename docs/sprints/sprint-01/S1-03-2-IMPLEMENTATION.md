# S1-03.2–S1-03.5 — SQLite migrations and Suite/Case CRUD

## Changes
- SQLite `PRAGMA user_version`: v1 adopts original schema; v2 adds `test_cases.kind` and `test_cases.description`.
- Existing Project rows are preserved; no destructive table rebuild.
- Suite: GET/PUT/DELETE `/api/suites/:id`; POST/GET `/api/projects/:projectId/suites`.
- Case: GET/PUT/DELETE `/api/cases/:id`; POST/GET `/api/suites/:suiteId/cases`.
- Web UI: Project → Suite → Case management; types `web`, `api`, `mobile`.
- Migration + HTTP CRUD test using a temporary SQLite file.

## Known limits
- Single-user local demo only; no authentication, tenant RBAC, audit, PostgreSQL RLS, concurrency or migration rollback strategy.
- PUT replaces optional Case fields with defaults when omitted; use complete payloads.
- Web UI uses browser prompt/confirm for edits and deletion, not production UX.
- No browser E2E test yet. Do not mark the full Sprint gate PASS solely from unit tests.

## Safe application
1. Stop API and back up SQLite (also `-wal` and `-shm` if present).
2. Extract overlay into repository root; do not delete `data/`.
3. Run `corepack pnpm typecheck` and `corepack pnpm test`.
4. Restart API, open Web, exercise Project → Suite → Case create/update/delete and verify old Project persists.
