# S1-04.1/2: Test Run Persistence and API

Scope: SQLite schema v3; Test Run records and HTTP API. **No actual browser/Python/Selenium execution yet.**

- POST /api/cases/:id/runs with `{ "engine": "playwright" | "pytest" | "selenium" }` creates a queued record.
- GET /api/cases/:id/runs returns recent runs (max 100).
- GET /api/runs/:id returns a single run.
- Runner lifecycle transitions are internal-only, not exposed to unauthenticated HTTP.
- Delete Case sets `test_case_id` to NULL but preserves `case_name` and run history.
- Engine validation: web→playwright/selenium, api→pytest, mobile→unsupported in this slice.
- Do not expose this local unauthenticated API to the network.

Gate requires Windows pnpm typecheck/test, old database preserved, API smoke test.
