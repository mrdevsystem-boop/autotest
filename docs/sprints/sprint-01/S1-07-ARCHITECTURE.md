# S1-07 — Automated UI Testing & Quality Gate

## Scope and decision

Extend the existing Playwright E2E runner in `apps/api/e2e/run.mjs` rather than introducing another framework. Preserve all six reporting regression groups and add four AI UI regression groups. No Kubernetes work or schema migrations are included.

## Isolation

The runner creates a unique temporary SQLite database, launches a local deterministic OpenAI-compatible mock (`apps/api/e2e/mock-ai.mjs`, port 4114), starts API (3101) with mock-only credentials, and starts Vite (5174). It uses browser-based interactions for generation, preview, discard, approval, and refresh. No external LLM network calls or pre-existing local databases are used.

Ports 3101, 4114, and 5174 must be free; Vite uses `--strictPort`. The mock only binds to loopback. The runner stops spawned processes and closes Chromium, removes temporary data on PASS, and retains failure artifacts on FAIL.

## Acceptance tests

1. Generate three drafts, inspect steps, assert database remains unchanged before approval.
2. Discard draft 2, assert it is absent and other drafts remain, with no database write.
3. Approve draft 1, assert exactly that draft persists and draft 3 remains in preview.
4. Approve draft 3, assert UI refreshes and database contains drafts 1 and 3, never 2.

## Quality gate

On Windows PowerShell 5.1 run `corepack pnpm typecheck`, `corepack pnpm --filter ./apps/api test`, `corepack pnpm --filter ./apps/web build`, and `corepack pnpm test:e2e`. All must pass before commit/merge. Browser binaries must be installed for Playwright. Keep untracked backup files untouched and stage only reviewed paths.

## Verification status

Implementation draft prepared from Git HEAD 317851b. Windows runtime verification is pending; no PASS is claimed for the new E2E cases until the user runs the quality gate.
