# AI Testing Platform — Current Roadmap

This document records the current implementation track.
The original Sprint 1 plan is preserved at:
docs/sprints/sprint-01/PLAN.md

## Verified milestones

- S1-01 through S1-04: completed on the prior implementation track.
- S1-05 Test Reporting: completed, merged and pushed to main.
- S1-05 verification commit: b8e901f.

## Current milestone

S1-06: AI Test Case Generation

- S1-06.1 Architecture and shared contracts
- S1-06.2 AI provider and backend generation API
- S1-06.3 Web preview and human approval
- S1-06.4 E2E and full regression

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
