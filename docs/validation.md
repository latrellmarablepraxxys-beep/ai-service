# Validation

The Express equivalent of a Laravel `FormRequest`: a small Zod schema plus a middleware factory.
Every external input (body, query, params — later webhooks and Laravel responses) is asserted here.

## Location and export shape

One file per endpoint concern: `src/api/http/validators/XValidator.ts`.

Each validated segment exports a triple, following `SendMessageValidator.ts` (which validates two
segments, so it exports two triples):

```ts
import { z } from 'zod';
import { createValidator } from './Validate.js';

export const sendMessageParamsSchema = z.object({ id: z.string().min(1) }).strip();
export type SendMessageParams = z.infer<typeof sendMessageParamsSchema>;
export const validateSendMessageParams = createValidator({
  schema: sendMessageParamsSchema,
  source: 'params',
});
```

- `xSchema` — the Zod schema (camelCase + `Schema` suffix).
- `X` — the parsed type via `z.infer` (PascalCase, same base name).
- `validateX` — the middleware built by `createValidator`.

Naming rules live in [conventions.md](./conventions.md).

## `createValidator({ schema, source })`

Defined in `src/api/http/validators/Validate.ts:18`; options type `ValidatorOptions` in
`src/interfaces/http.ts:63`.

| option | type | notes |
|---|---|---|
| `schema` | `ZodTypeAny` | the schema to apply |
| `source` | `'body' \| 'query' \| 'params'` | request segment to read from and write back to |

On success the parsed output replaces the raw segment on `req`. On failure it calls
`next(new AppError('VALIDATION_ERROR', 422, 'Validation failed', { fields }))`; the single Express
error handler renders the envelope below.

## Error contract

Status **422**, body:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": { "fields": { "content": ["String must contain at least 1 character(s)"] } }
  }
}
```

- `details.fields` maps a dot-joined issue path to its messages: `field`, `nested.field`.
- Root-level issues (a `.refine` on the whole object) use `""` as the key.
- Zod internals (`issues`, `unionErrors`) are never echoed — see `flattenIssues`
  (`src/api/http/validators/Validate.ts:7`).

## Adding a validator

1. Create `src/api/http/validators/<concern>Validator.ts`.
2. Define `xSchema` with `.strip()` and export its `z.infer` type.
3. Export `validateX = createValidator({ schema: xSchema, source })`.
4. Mount it on the route in `src/api/http/routes.ts`, before the handler.
5. Add a test under `tests/unit/api/http/validators/<concernValidator>.test.ts` (camelCase;
   precedent `sendMessageValidator.test.ts`).

## Testing a validator

Build a throwaway Express app, mount the validator, then the real `errorHandler`, and drive it with
`supertest` (precedent: `tests/unit/api/http/validators/sendMessageValidator.test.ts`).

```ts
const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.post('/tickets/:id/messages', validateSendMessageParams, validateSendMessageBody, handler);
  app.use(errorHandler);
  return app;
};
```

Assert: a valid request passes parsed data through (200), an unknown key is stripped, and an
invalid request returns 422 with `error.code === 'VALIDATION_ERROR'` and a populated
`details.fields.<field>`.

## Gotchas

- **Express 5 `req.query` is getter-only.** Plain assignment (`req.query = parsed`) throws. The
  factory writes parsed output with `Object.defineProperty(req, source, { value, writable: true,
  configurable: true, enumerable: true })` (`src/api/http/validators/Validate.ts:33`).
- **Zod is pinned to v3** (`package.json` -> `"zod": "^3.23.8"`). Do not use v4-only APIs.
- **Query values are strings.** Use `z.coerce.number().int()` for numerics, not `z.number()`
  (`src/api/http/validators/PaginationQueryValidator.ts:7`).
- **`perPage` is capped at 100** (HTTP default 20): the validator rejects `perPage > 100` with 422,
  and `resolvePagination` clamps direct repository calls to `[1, 100]` (repo default 50).
  See `PaginationQueryValidator.ts` and `src/persistence/repositories/Helpers.ts`.
- **`.strip()` drops unknown keys.** Because the parsed object is written back, downstream code sees
  only schema-declared fields; previously accepted extras are removed.
- **Attachments are URL-only, never bytes.** Images and files travel as public URLs (or IDs)
  in `metadata` / knowledge-base references — e.g. `metadata: { imageUrl: 'https://…' }` — so the
  AI can send pictures through the Meta Send API without any bytes crossing our JSON bodies. Never
  stuff base64/data-URLs into `content` or `metadata`: the 1mb `express.json` limit
  (`src/app.ts`) rejects them first, and oversize rejections surface as 413 `PAYLOAD_TOO_LARGE`.
- **Single assertion seam.** Assert external input once, here, before it reaches a controller,
  service, or graph node. Downstream code trusts the parsed type and never re-checks or casts. To
  add a rule, extend the schema — do not add a second guard.
- **Enum inputs accept numbers, responses emit numbers.** A status/priority filter uses
  `z.nativeEnum(TicketStatus)` (query values arrive as strings, so pair with `z.coerce`);
  response bodies carry the int directly — numeric enums serialize as numbers, so clients see `1`
  while code reads `TicketStatus.Open`. See [conventions.md](./conventions.md#code-words-wire-numbers).

## Related

- Route table and error envelope: [routes.md](./routes.md).
- Naming: [conventions.md](./conventions.md).
