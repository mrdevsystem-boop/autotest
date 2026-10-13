# AI Testing Platform — Sprint 1 starter

This is a **minimal no-Docker bootstrap**, not the completed platform. The initial API is a Node HTTP health endpoint; the web page is a Vite placeholder. NestJS, Next.js, Prisma, Device Lab, runners, and production security controls remain future implementation tasks.

## Windows setup
In PowerShell, at repository root:

```powershell
corepack enable
corepack pnpm --version
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
```

If `pnpm` is on PATH, you may use `pnpm` instead of `corepack pnpm`.

Run two separate PowerShell terminals:

```powershell
corepack pnpm dev:api
```

```powershell
corepack pnpm dev:web
```

Open http://127.0.0.1:5173 and http://127.0.0.1:3001/health .

## Source integration
Extract ZIP into `D:\Projects\autotest`, preserving paths. Review with `git status`, then commit/push only after local verification. Never commit `.env` or secrets.

## Constraints
4 GB Windows laptop is suitable for editing and lightweight Node smoke checks only. Do not install/run Android Emulator or a full Docker stack on it. iOS runner requires macOS/cloud infrastructure.
