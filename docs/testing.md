# Testing

Runner: **Vitest** (`vitest.config.ts`). Layout: `tests/unit`, `tests/integration`, `tests/e2e`.

## Layers

- **Unit** — pure logic: routing rules, normalizers, guards, Zod schemas, graph node functions.
  Most tests live here. No network.
- **Integration** — HTTP endpoints via `supertest` (webhook verification, ticket routes); graph runs
  with fake LLM/Laravel/Typesense clients injected.
- **E2E** — full graph run with a `FakeLlmProvider`, asserting the flow ends in the expected route
  (`ai` or `agent`) and that escalation fires when expected.

## Commands

```bash
npm test             # run once
npm run test:watch   # watch mode
npm run test:coverage
```

Coverage thresholds: **80%** lines/functions/branches/statements (`src/**`, excluding `config/` and
`scripts/`).

## Rules

- Test logic, not the framework.
- Never hit the network in unit tests — inject fakes for the LLM, Laravel API, and Typesense.
- Every bug fix starts with a failing test.
- Keep nodes small and pure so they are trivially testable.

## Phase 1 additions

- **Fakes** (`tests/fakes/`): `FakeKnowledgeService` (canned templates, topics, catalog products,
  promotions with per-concern overrides) and the extended `FakePersistence` (in-memory threads,
  messages, memories, runs plus `conversationStates`, `decisions`, `escalations` with deterministic
  ids — no Mongo).
- **Pipeline flows** (`tests/unit/services/conversation/conversationService.test.ts`): end-to-end
  turn coverage through `TurnPipeline` + `ConversationService` — first-turn greeting splice (stage
  `Greeted`), variant clarification (stage `AwaitingVariant`), installment quote with variant image
  attachment (stage `Quoted`), freebies package with merchants (stage `FreebiesSent`), guard
  escalation without an LLM call (`transferToAgent: true`, `route: 'agent'`), invalid-JSON fallback
  line, run provenance (`promptKey: 'response_agent'`, `knowledgeUsed`), `Failed`-on-write-error
  with rethrow, and `externalId` dedupe.
- **Mock↔service contract** (`tests/integration/knowledgeServiceContract.test.ts`): boots the real
  `MockAdminApp` on an ephemeral port and drives `KnowledgeService` through `DomainHttpClient`
  against it — 12 escalation topics, the greeting template (`{{branch_page}}`, version 1), the
  Click 125 product (2 variants, exact STD terms), and the 10-item installment freebies package.
- **Guard regression** (`tests/unit/services/turn/escalationGuard.test.ts`): whole-phrase matching
  (no `plate`-in-`template` substring hits), case/punctuation/Tagalog variants, longest-keyword
  wins, array-order tiebreak, separator variants (`7-11` / `711` / `seven eleven`).
- **Decision layer** (`tests/unit/services/decision/`): wire-schema parsing
  (`decisionSchema.test.ts`) and post-checks A–F (`decisionValidator.test.ts`) — guard-wins
  coercion, unknown-topic fallback, payment/variant gating with variant-first ordering, greeting
  flag, and `ai_inferred` confidence pruning.
