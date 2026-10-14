# AI Testing Platform — Current Roadmap

This document records the current implementation track.
The original Sprint 1 plan is preserved at:
docs/sprints/sprint-01/PLAN.md

## Verified milestones

- S1-01 through S1-04: completed on the prior implementation track.
- S1-05 Test Reporting: completed, merged and pushed to main.
- S1-05 verification commit: b8e901f.
- S1-06 AI Test Case Generation: merged to main in PR #1, merge commit 317851b; local sync verified.

## Current milestone

S1-07: Automated UI Testing & Quality Gate (implementation in progress)

- S1-07.1 Discovery: complete
- S1-07.2 Architecture: documented in `docs/sprints/sprint-01/S1-07-ARCHITECTURE.md`
- S1-07.3 AI UI automated regression: patch prepared; Windows verification pending
- S1-07.4 Full quality gate and merge: pending

## Historical-plan reconciliation

The original Sprint 1 plan used different milestone names:
S1-06 Outbox and Queue, S1-07 Kubernetes smoke job, etc.

Those items are retained as historical planned work.
They are not marked implemented or verified by this roadmap.
They require separate reprioritization.

## Working rules

- Local-first development
- Explicit human approval before persistence
- Mock AI provider for automated tests
- Verification before commit and merge
- Preserve historical plans and audit evidence
