# S1-06 — AI Test Case Generation

Status: DESIGN APPROVED; IMPLEMENTATION PENDING

## Goal

Generate structured web test-case drafts from natural-language
requirements. A user must review and approve drafts before saving.

## Architecture

Web UI
  -> POST /api/ai/test-cases/generate
  -> AI orchestration
  -> OpenAI-compatible provider
  -> Backend output validation
  -> Draft preview
  -> Explicit user approval
  -> Existing POST /api/suites/:suiteId/cases

Generation must not mutate the database or execute tests.

## Request contract

- suiteId: existing suite UUID
- requirement: non-empty string, maximum 4000 characters
- maxCases: integer 1..5, default 3

## Response contract

HTTP 200:
{
  "data": {
    "drafts": [
      {
        "name": "Example",
        "description": "Example description",
        "kind": "web",
        "steps": [
          { "action": "expectTitle", "text": "Example" }
        ]
      }
    ]
  }
}

The example describes the schema, not a verified executable test.

## Output validation

- 1..maxCases drafts
- name: non-empty, maximum 120 characters
- description: maximum 2000 characters
- kind: web only
- steps: 1..30 actions
- Reuse parseWebSteps from the current Playwright runner
- Supported actions: goto, click, fill, expectText, expectTitle
- Navigation remains restricted to loopback URLs
- Reject invalid provider output; never partially accept it
- AI-generated selectors are unverified until reviewed

## Error contract

400 invalid_generation_request
404 suite_not_found
502 ai_provider_error
502 invalid_ai_output
503 ai_not_configured
504 ai_timeout

## Provider design

AIProvider is injected into the orchestration layer.
Implementations:
- OpenAICompatibleProvider
- MockAIProvider for deterministic tests

Environment:
- AI_BASE_URL
- AI_API_KEY
- AI_MODEL
- AI_TIMEOUT_MS (default 20000)

Provider requests must use bounded timeouts and response sizes.
Never expose credentials in responses or logs.

## Persistence

No database migration is planned for this slice.
Only user-approved drafts are submitted to the existing case API.
Serialize the steps array as a JSON string before persistence.

## Verification gates

1. Contract and documentation review
2. Typecheck and unit tests
3. Mock-provider API tests
4. Web approval and persistence E2E
5. Full regression and production build

No commit or merge before the relevant verification gate passes.

## Out of scope

- Autonomous browser exploration
- Automatic execution after generation
- AI-driven database writes
- Mobile/API test generation
- Agent tool calls or filesystem access
