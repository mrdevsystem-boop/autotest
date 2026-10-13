# S1-02 incremental implementation — Gate pending

## Delivered in this overlay
- Project CRUD via native Node HTTP: GET/POST /api/projects, GET/PUT/DELETE /api/projects/:id
- Validation, limited request size, localhost CORS, API CRUD tests
- Browser UI to create/list/delete projects
- PostgreSQL schema design draft (not applied)

## Explicit limitations
- In-memory demo only; data lost on API restart
- No auth, no tenant isolation, no RLS, no persistent database, no Device Lab implementation
- Do not expose API publicly; bind to 127.0.0.1 only
- UI has create/list/delete; update supported by API but not UI
- Gate cannot PASS without Windows tests and browser verification

## Local verify
`corepack pnpm install`
`corepack pnpm typecheck`
`corepack pnpm test`
`corepack pnpm dev:api` and `corepack pnpm dev:web` in separate terminals

## Remote database next
Provision PostgreSQL on an accessible server; restrict inbound access, use VPN or SSH tunnel, TLS and unique app credentials. Implement migrations and tenant-scoped auth before moving beyond localhost.
