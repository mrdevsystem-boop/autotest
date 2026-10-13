# LLD — Device Lab and runner contracts (design only)

## Entities
`device_hosts(id, tenant_id, host_type, os, last_heartbeat_at, status)`
`devices(id, tenant_id, host_id, kind, os_version, model, capabilities_json, health, allocation, last_seen_at)`
`device_leases(id, tenant_id, device_id, run_id, lease_token_hash, expires_at, released_at)`
`test_runs(id, tenant_id, project_id, runner_type, status, created_at)`
`test_artifacts(id, tenant_id, run_id, type, object_key, sha256)`

## Device lifecycle
REGISTER -> ONLINE/AVAILABLE -> RESERVED -> IN_USE -> CLEANING -> AVAILABLE; OFFLINE/DEGRADED/MAINTENANCE can block scheduling. Lease acquisition must be atomic and unique for active device lease. Lease expiry alone does not prove cleanup; quarantine on uncertain ownership.

## Runner lifecycle
QUEUED -> WAITING_FOR_DEVICE -> PROVISIONING -> RUNNING -> COLLECTING -> COMPLETED/FAILED/CANCELLED. Runner adapters: validate, provision, execute, collect, cancel, cleanup. Job retries require idempotency and explicit policy.

## Security
Tenant-scoped database access and authorization, no runner-to-database direct mutation, credentials scoped to one run, artifacts scanned/redacted, approved agent enrollment. Secrets must not be stored in source.

## Implementation status
This is an architectural contract, not implemented endpoints or migrations.
