# Routes

Base path: `/api` (health and metrics are unprefixed).

`GET /health` probes Mongo, Redis, Typesense and the active LLM provider (a real, tiny embeddings call). It returns 503 when any check is down.

**Implemented today:** `/health`, `/metrics`. Everything below the metrics row is the target contract — not yet routed.

| method | path | auth | db | status | notes |
|---|---|---|---|---|---|
| GET | `/health` | no | no | implemented | mongo/redis/typesense/llm; 200 / 503 |
| GET | `/metrics` | no | no | implemented | Prometheus metrics |
| GET | `/api/webhooks` | no | no | planned | webhook verification (`hub.challenge`) |
| POST | `/api/webhooks` | HMAC | no | planned | ingest messages + comments |
| GET | `/api/tickets` | yes | no | planned | list via domain API |
| GET | `/api/tickets/:id` | yes | no | planned | detail via domain API |
| POST | `/api/tickets/:id/messages` | yes | yes | planned | **SSE**: routes + responds |
| GET | `/api/tickets/:id/messages` | yes | yes | planned | transcript (MongoDB) |
| POST | `/api/tickets/:id/escalate` | yes | yes | planned | force handoff to an agent |

## SSE protocol

`POST /api/tickets/:id/messages` with `Accept: text/event-stream` emits:

```
event: status   data: {"status":"understanding"}
event: chunk    data: {"chunk":"..."}      (repeated)
event: complete data: {"messageId":"...","threadId":"..."}
event: error    data: {"error":"..."}
```

A keep-alive comment (`: keepalive`) is sent every 15 seconds.

## Conventions

- Errors: `{ success: false, error: { code, message } }`.
- Validation failures: **422** with `{ success: false, error: { code: "VALIDATION_ERROR", message, details: { fields } } }`.
- Mutating routes require auth (Laravel token validation).
- Webhooks must verify the signature and dedupe by event id.
