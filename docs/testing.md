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
