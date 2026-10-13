# HLD — AI Testing Platform v1.2 (baseline)

## Scope
Web: Playwright (primary) and Selenium (compatibility); API: pytest/HTTPX; Mobile: Android emulator + real device, iOS simulator + real device (all mandatory MVP acceptance targets).

## Control plane
Web portal -> API -> PostgreSQL (tenant-scoped) -> transactional outbox -> Redis/BullMQ scheduler -> execution controller -> runners -> artifact storage (MinIO/S3) -> result collector -> reporting/AI analysis.

## Execution plane
- Playwright and Selenium runners execute browser test jobs.
- Android Device Agent runs on Windows/Linux host and controls Appium/ADB; emulator or real Android device.
- iOS Device Agent runs on macOS with Xcode/Appium XCUITest; simulator or real iPhone/iPad. Windows cannot host official iOS Simulator.
- Device Lab handles registry, host heartbeat, capability matching, exclusive leases, cleanup, health and quarantine.

## Security gates
Tenant RBAC, signed/expiring job credentials, no secrets in test artifacts, audit, strict isolation, approvals for AI-generated changes. Do not run untrusted test code on the API host.

## Acceptance policy
A feature is PASS only after reproducible tests and retained evidence. Android/iOS real device claims require actual device execution. Mac/cloud runner is a dependency for iOS.
