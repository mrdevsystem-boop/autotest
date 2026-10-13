# S1-04.4 — Test Execution UI

Scope: Vite + vanilla TypeScript only. No new dependency or database migration.

- Preserve Project / Suite / Case CRUD.
- Web cases show Run Test, run history (up to 100 from API), status, duration, and output/error logs.
- POST /api/cases/:id/runs then POST /api/runs/:id/execute. Poll GET /api/runs/:id every 1.5 seconds until terminal state.
- API and Mobile cases display unsupported-runner hint.
- Correct Vietnamese UI text to UTF-8.
- Render user-controlled strings via textContent (avoid HTML injection).

## Verification

1. `corepack pnpm typecheck`
2. `corepack pnpm test`
3. Run API + Web; open http://127.0.0.1:5173; click Run Test on a Web Case with valid steps.
4. Confirm queued/running/passed or failed, log, duration, history after reload.
5. Confirm Project/Suite/Case CRUD and unsupported API/Mobile cases.

Known limitations: no authentication (local only); no cancellation or cross-tab execution coordination; polling stops after five consecutive request failures; no UI browser automation tests yet. A queued record can remain if execute returns an error. The UI disables Run Test only while its own active run is tracked.
