# S1-04.3 Playwright Runner — local-only

Adds `POST /api/runs/:id/execute` for queued Playwright runs. It responds HTTP 202 with `running` and runs Chromium asynchronously. Poll `GET /api/runs/:id` for `passed`, `failed`, or `error`.

Test Case `steps` must be a JSON array (1–30 steps) with actions: `goto` (`url`), `click` (`selector`), `fill` (`selector`, `value`), `expectText` (`selector`, `text`), `expectTitle` (`text`). Only localhost/127.0.0.1/[::1] navigation is allowed. External browser requests are blocked. One run at a time per API process. 30s overall timeout, 5s action timeout. No arbitrary JS or shell execution.

Install: `corepack pnpm install`, `corepack pnpm --filter @aitest/api exec playwright install chromium`. Chromium download may require additional disk space. Run `corepack pnpm typecheck` and `corepack pnpm test`. Restart API. For manual browser smoke test, start local Web app and update a web case with JSON steps such as `[ {"action":"goto","url":"http://127.0.0.1:5173"}, {"action":"expectText","selector":"h1","text":"AI Testing Platform"} ]`; create run via POST `/api/cases/:id/runs` with `{ "engine": "playwright" }`; POST `/api/runs/:id/execute`; poll GET `/api/runs/:id`.

Limitations: No cancellation API, screenshots, cross-process concurrency guard, auth/RBAC, durable job recovery, or remote URL support. Restart during execution can leave status `running`. No browser test is executed by unit tests; manual Chromium smoke test required for gate.
