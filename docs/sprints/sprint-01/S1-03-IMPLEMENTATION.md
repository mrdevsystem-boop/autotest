# S1-03 Local SQLite Persistence

- Node.js 24 `node:sqlite` (DatabaseSync), no external DB required.
- SQLite path defaults to `data/aitest.sqlite` at repository root when API launched via pnpm workspace.
- Override with `AITEST_DB_PATH` for testing/deployment.
- Schema is created idempotently on startup (baseline initialization, not versioned migrations).
- Project CRUD keeps existing API; adds suites and cases endpoints.
- `GET/POST /api/projects/:projectId/suites`
- `DELETE /api/suites/:suiteId`
- `GET/POST /api/suites/:suiteId/cases`
- `DELETE /api/cases/:caseId`
- Cascade deletes enabled by foreign keys.
- SQLite is local-only. Cloud PostgreSQL migration/RLS and tenant isolation remain outstanding.
- Suite/case UPDATE and full web UI are not implemented in this increment.
- Gate: typecheck, tests, API smoke, restart persistence, Git commit/push.
