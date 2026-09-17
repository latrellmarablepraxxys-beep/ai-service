# MotorCentral Omnichannel AI

An AI service built with Express + TypeScript + LangGraph. It ingests messages and comments, turns
them into tickets, routes each ticket to AI or a human agent, and lets the AI escalate to an agent
based on the conversation.

## Stack
- Runtime: Node.js >= 22, TypeScript (ESM, strict)
- HTTP: Express 5
- Orchestration: LangGraph (+ @langchain/openai, provider-agnostic via baseURL)
- Own state: MongoDB (threads/messages/memories/runs), Redis + BullMQ (jobs/cache)
- Search/RAG: Typesense (shared with the Laravel backend)
- Domain data (tickets/agents/SLA): Laravel API (NOT owned here — no ORM)
- Observability: pino + prom-client

## Commands
| command | what it does |
|---|---|
| `npm run dev` | hot-reload dev server (tsx watch) |
| `npm run build` | compile src -> dist (tsc) |
| `npm start` / `npm run start:prod` | run compiled server |
| `npm run typecheck` | tsc --noEmit |
| `npm run lint` / `lint:fix` | ESLint (flat config) — the style authority; column-aligned arrays/objects |
| `npm test` / `test:watch` / `test:coverage` | Vitest |
| `npm run verify` | `typecheck` + `lint` + `test` |
| `npm run llm:smoke` | smoke-test the configured LLM provider |
| `npm run db:init-collections` | create the service-owned Mongo collections (idempotent) |
| `npm run db:create-indexes` | ensure Mongo collection indexes (idempotent) |
| `npm run db:setup` | collections + indexes (`db:init-collections && db:create-indexes`) |
| `npm run db:clear` | delete all documents (keeps schema/indexes) — needs `-- --force` |
| `npm run db:fresh` | drop + recreate collections + indexes — needs `-- --force` |
| `npm run mongo:init` | alias of `db:setup` (collections + indexes) |
| `npm run typesense:init` | create Typesense collections |
| `npm run db:seed` | seed local data |

**Check order:** `typecheck` -> `lint` -> `test`.

**Style:** ESLint is the authority (`lint:fix` formats). Never run `prettier --write` — it collapses the column-aligned arrays/objects the lint rules enforce.

## Folder structure
```
src/
├── index.ts              # entry: build app, connect Mongo/Redis, start jobs
├── app.ts                # express app: middleware, routes, error handler
├── api/
│   ├── http/
│   │   ├── controllers/  # thin handlers
│   │   ├── validators/   # Zod request validation (see docs/validation.md)
│   │   ├── middleware/   # auth, rate limit, request logging, errors
│   │   └── routes.ts     # route table
│   └── sse/              # SSE helper
├── graph/                # LangGraph state machines
│   ├── routing/          # classify -> route (ai | agent | queue)
│   └── escalation/       # interrupt -> escalate -> handoff
├── services/
│   ├── llm/              # provider factory (LangChain model wrappers)
│   ├── domain/           # typed admin API clients (tickets, agents, sla)
│   ├── typesense/        # search/RAG client
│   └── cache/            # redis cache
├── persistence/          # mongo models + repositories
├── config/               # env loading/validation
├── interfaces/           # type-only port contracts (no runtime)
├── enums/                # int enums (statuses, priorities)
├── prompts/              # prompt templates
├── jobs/                 # bullmq workers
└── utils/                # logger, metrics, errors
scripts/                  # init/seed scripts
tests/{unit,integration,e2e}/
docs/                     # architecture, environment, routes, testing
```

## Conventions
- **ESM only** — `"type": "module"`; relative imports MUST use `.js` (e.g. `import { x } from './x.js'`).
- **Strict TypeScript** — no `any` (warned); prefer `unknown` + Zod at boundaries.
- **Validate every external input** (webhooks, LLM output, Laravel responses) with Zod. HTTP validators live in `src/api/http/validators/XValidator.ts` (see `docs/validation.md`).
- **Naming**: layer files PascalCase = primary export/concern (`src/services/`, `src/api/**/{controllers,validators,middleware,sse}/`, `src/persistence/`, `src/enums/`, `src/graph/`, `src/prompts/`); `src/config/`, `src/interfaces/`, `src/utils/`, `src/api/http/routes.ts`, `scripts/`, `tests/` stay camelCase; factories `create*`/`build*`; types PascalCase + role suffix (`Options`/`Input`/`Response`/`Body`). Full table in `docs/conventions.md`.
- **Enums**: int enums (from 1) in `src/enums/<Concern>.ts`; use members directly in code, validate inbound ints with `z.nativeEnum(...)` — numeric enums serialize as numbers, no mapping layer.
- **No ORM for domain data** — call the Laravel API; own state only in MongoDB.
- **LangGraph** is the orchestration backbone; nodes are small, pure, testable functions.
- **Errors**: throw typed `AppError`; one Express error handler.
- **Interfaces live in `src/interfaces/`** — never declare `interface`/`type` contracts inside implementation files; put them in `src/interfaces/<concern>.ts` and `import type` them. No barrels.
- **Logging**: use `pino` (never `console.log` in `src/`).
- **No secrets in code** — env only; never log PII or tokens.

## Gotchas
- NodeNext requires `.js` extensions on relative imports.
- LangGraph JS is pre-1.0 — pin versions; API moves between minors.
- `mongodb` connect is async — connect before serving DB routes.
- Webhooks can be replayed/out-of-order — dedupe by event id.
- Typesense + Redis are external — endpoints degrade if they're down.
