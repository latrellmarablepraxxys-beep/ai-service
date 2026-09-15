# Conventions

Naming standard for this repo. Layer files under `src/` are PascalCase; support files
(`src/config/`, `src/interfaces/`, `src/utils/`, `src/api/http/routes.ts`), tests, and scripts are
camelCase. Every relative import uses the `.js` extension (NodeNext ESM). Tests import `src/`
through folder aliases (`@config/*`, `@interfaces/*`, `@services/*`, `@utils/*`, `@src/*`, …) —
defined in `tsconfig.json` (`paths`) and `vitest.config.ts` (`resolve.alias`). `src/` itself stays
relative: `tsc` does not rewrite aliases, so `node dist` would break. Style authority is
ESLint (`npm run lint:fix`) — column-aligned multiline arrays/objects. Never run `prettier --write`:
it collapses that style. When in doubt, match the
precedent in the right-hand column.

## Files

| artefact | convention | example | precedent |
|---|---|---|---|
| layer source file (`src/services/`, `src/api/**` except `routes.ts`, `src/persistence/`, `src/enums/`, `src/graph/`, `src/prompts/`) | PascalCase, named after its primary export/concern; role suffixes like `*Controller.ts`, `*Validator.ts`, `*Repository.ts` | `ErrorHandler.ts`, `SendMessageValidator.ts`, `ThreadStatus.ts`, `LlmProvider.ts`, `ThreadRepository.ts` | `src/api/http/middleware/ErrorHandler.ts`, `src/api/http/validators/SendMessageValidator.ts`, `src/enums/ThreadStatus.ts`, `src/services/llm/LlmProvider.ts`, `src/persistence/repositories/ThreadRepository.ts` |
| support source file (`src/config/`, `src/interfaces/`, `src/utils/`, `src/api/http/routes.ts`) | camelCase, named after its primary export/concern | `env.ts`, `errors.ts`, `routes.ts` | `src/config/env.ts` |
| test file | camelCase `<subject>.test.ts`, mirroring the `src/` concern path | `validate.test.ts`, `threadStatus.test.ts` | `tests/unit/api/http/validators/validate.test.ts` |
| fake/stub helper in tests | camelCase, no `.test.ts` suffix | `stubDependencies.ts`, `fakeMongo.ts` | `tests/unit/api/http/stubDependencies.ts` |
| source script | camelCase under `scripts/`, named after the operation | `initMongo.ts`, `seed.ts` | `scripts/initMongo.ts` |
| shared test fake | camelCase under `tests/fakes/`; exempt from the `src/` mirror path | `fakeLlmProvider.ts` | `tests/fakes/fakeLlmProvider.ts` |
| cross-cutting test | may span several concerns instead of mirroring one `src/` file | `enumSerialization.test.ts` | `tests/unit/enums/enumSerialization.test.ts` |

A layer file is named for its dominant concern, not necessarily its factory. Exceptions:
`src/api/http/validators/Validate.ts` is the validator factory exporting `createValidator`;
`src/persistence/repositories/Helpers.ts` is a multi-export helper module (pagination, errors,
`ObjectId`); `src/persistence/models/Collections.ts` exports `COLLECTIONS` / `COLLECTION_INDEXES`.
The filename-case ESLint rule (`eslint.config.js`) enforces this split.

## Functions and factories

| artefact | convention | example | precedent |
|---|---|---|---|
| function / method | camelCase, verb-first | `toErrorResponse`, `flattenIssues`, `resolvePagination` | `src/utils/errors.ts:48` |
| factory | `create*` (stateful clients, routers, repositories, middleware) | `createValidator`, `createHttpRouter`, `createThreadRepository` | `src/api/http/validators/Validate.ts:18`, `src/api/http/routes.ts:26` |
| builder | `build*` (compose an object graph) | `buildExpressApp` | `src/app.ts:31` |
| guard | `is*` / `has*` returning a type predicate | `isAppError`, `isMalformedJsonError` | `src/utils/errors.ts:19` |

Prefer a factory that returns a plain object typed by an interface over a class. The only class
precedent is `AppError` (`src/utils/errors.ts:5`), which extends `Error`.

## Classes, types, and interfaces

| artefact | convention | example | precedent |
|---|---|---|---|
| class | PascalCase + role suffix (rare) | `AppError` | `src/utils/errors.ts:5` |
| interface / type | PascalCase + role suffix (`Options`, `Input`, `Response`, `Body`, `Result`, `Repository`, `Client`) | `ValidatorOptions`, `CreateThreadInput`, `BaseResponse`, `ErrorResponse`, `PaginatedResult` | `src/interfaces/http.ts:63`, `src/interfaces/errors.ts:3` |
| request-body type | PascalCase + `Body` | `SendMessageBody` | `src/api/http/validators/SendMessageValidator.ts:25` |
| validator options | PascalCase + `Options` | `ValidatorOptions` | `src/interfaces/http.ts:63` |

Interfaces and type-only contracts live in `src/interfaces/<concern>.ts` and are imported with
`import type`. Never declare a contract inside an implementation file. No barrels.

Sanctioned exemptions:

- Frozen config singletons (`*Config` in `src/config/*`, e.g. `appConfig`, `redisConfig`) declare
  and export their own `typeof`-derived type next to the value.
- `z.infer` DTOs stay next to their schema in the validator file (`SendMessageBody`,
  `PaginationQuery`) — the schema is the source of truth.
- Hand-written shared contracts go in `src/interfaces/`.

## Zod schemas

camelCase + `Schema` suffix, `const`-exported next to a `z.infer` type of the same base name.

```ts
export const sendMessageParamsSchema = z.object({ id: z.string().min(1) }).strip();
export type SendMessageParams = z.infer<typeof sendMessageParamsSchema>;
```

Precedent: `src/api/http/validators/SendMessageValidator.ts:5`. Validation details live in
[validation.md](./validation.md).

## Constants, error codes, env

SCREAMING_SNAKE is reserved for true module constants, `AppError` codes, and env var names.
Frozen objects and runtime instances stay camelCase (`appConfig`, `logger`, `metrics`) — they are
values, not constants.

| artefact | convention | example | precedent |
|---|---|---|---|
| module constant | SCREAMING_SNAKE | `JSON_BODY_LIMIT`, `INTERNAL_ERROR_MESSAGE`, `SENSITIVE_DETAIL_KEYS` | `src/app.ts:13`, `src/utils/errors.ts:26` |
| `AppError` code | SCREAMING_SNAKE string literal | `'VALIDATION_ERROR'`, `'INVALID_JSON'`, `'PAYLOAD_TOO_LARGE'`, `'NOT_FOUND'` | `src/api/http/validators/Validate.ts:26` |
| env var | SCREAMING_SNAKE, grouped by concern | `DOMAIN_API_URL`, `TYPESENSE_COLLECTION_PREFIX` | `src/config/env.ts:58` |

## Routes

- Paths are lowercase kebab-case; params are `:name` (`:id`).
- Precedent: `/health/llm`, `/api/tickets/:id/messages`, `/api/tickets/:id/escalate` (`src/api/http/routes.ts`).

## MongoDB own-state

- Field names camelCase and mirror the port entities in `src/interfaces/persistence.ts`
  (`ticketId`, `threadId`, `tokenCount`, `createdAt`, `updatedAt`, `perPage`, `hasNextPage`).
- The boundary `id` is stored as MongoDB `_id` and mapped inside repositories
  (`src/interfaces/mongo.ts:9`).
- Collection names are lowercase plural (`threads`, `messages`, `memories`, `runs`) and registered
  once in `src/persistence/models/Collections.ts:11`.
- Documents are `Omit<Entity, 'id'>` (`src/interfaces/mongo.ts:9`).

## Laravel domain payloads

- Wire payloads are **snake_case** and statuses/priorities arrive as **ints** (Laravel DB values).
- Use the int enums in `src/enums/` directly: validate inbound ints with `z.nativeEnum(...)` at the
  validator boundary, and pass enum members straight through — numeric enums serialize as their
  number, so no mapping layer is needed.
- Typical wire fields: `assigned_agent_id`, `sla_id`, `external_id`, `first_response_minutes`.
- The domain clients live in `src/services/domain/`; they own the snake_case <-> camelCase boundary.

## Typesense

- Collection names use the `ai_` prefix plus snake_case (`TYPESENSE_COLLECTION_PREFIX`, default
  `ai_`, `src/config/env.ts:58`).
- Index fields are snake_case; the Typesense SDK options are snake_case (`query_by`, `filter_by`,
  `sort_by`, `per_page`, `limit_hits`, `default_sorting_field`, `token_separators`).
- The port (`src/interfaces/search.ts`) stays camelCase (`queryBy`, `filterBy`, `sortBy`,
  `perPage`, `maxHits`); conversion happens once at the adapter boundary
  (`src/services/typesense/TypesenseSearchClient.ts:84`).

## Booleans

- Predicates are `is*` / `has*` (`isAppError`, `hasNextPage`).
- Data-shape booleans may read as adjectives when they are a noun property, not a predicate
  (`HealthStatus.connected`, `IndexSpec.unique`).

## Enums

### Location and shape

- One concern per file: `src/enums/<Concern>.ts` (e.g. `ThreadStatus.ts`, `TicketStatus.ts`,
  `TicketPriority.ts`, `RunStatus.ts`).
- Use a regular `enum`, never `const enum` (isolated-modules + ESM safe).
- Member names are PascalCase; integer values start at `1` and are explicit.

```ts
export enum ThreadStatus {
  Active = 1,
  Escalated = 2,
  Closed = 3,
}
```

Precedent: `src/enums/ThreadStatus.ts:1`.

### Int-enum rule for model statuses

Statuses/priorities stored on Mongo documents or received from the Laravel API are declared as int
enums in `src/enums/` and used directly — no mapper layer. `Thread`/`Run` carry the enum
type directly (`src/interfaces/persistence.ts:1` imports and re-exports `ThreadStatus`/`RunStatus`);
repositories read and persist the int as-is. Inbound validation happens once at the HTTP boundary
with `z.nativeEnum(...)` (see `docs/validation.md`); the int enum is the canonical representation
everywhere.

### Code words, wire numbers

In code always use the word (`TicketStatus.Open`, `ThreadStatus.Active`). On the wire — HTTP
responses, Mongo documents, Laravel payloads — always use the number (`1`, `2`, …). Numeric enums
serialize to numbers by default, so `res.json({ status: TicketStatus.Open })` renders
`{"status":1}` — just pass enum members straight through. Never serialize the reverse lookup
(`TicketStatus[1]` === `'Open'`): names are for developers reading code, numbers are for clients
reading responses.

### What NOT to enum

| do not enum | use instead | precedent |
|---|---|---|
| HTTP status codes | the numeric `status` passed to `AppError` | `src/utils/errors.ts:10` |
| `AppError` codes | SCREAMING_SNAKE string literals | `src/utils/errors.ts` |
| port error codes | string-literal unions in `src/interfaces/` | `DomainErrorCode`, `PersistenceErrorCode` |
| env-selected values | Zod `z.enum([...])` | `src/config/env.ts:12` |
