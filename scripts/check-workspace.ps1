$ErrorActionPreference = 'Stop'
Write-Host '== Workspace checks =='
node --version
corepack --version
corepack pnpm --version
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
Write-Host 'Workspace verification complete.'
