# Routes

Base path: `/api` (health and metrics are unprefixed).

`GET /health` probes Mongo, Redis, Typesense and the active LLM provider (a real, tiny embeddings call). It returns 503 when any check is down.

**Implemented today:** `/health`, `/metrics`, and `POST /api/v1/tickets/:ticketId/conversations`. Everything else below the metrics row is the target contract — not yet routed.

| method | path | auth | db | status | notes |
|---|---|---|---|---|---|
| GET | `/health` | no | no | implemented | mongo/redis/typesense/llm; 200 / 503 |
| GET | `/metrics` | no | no | implemented | Prometheus metrics |
| POST | `/api/v1/tickets/:ticketId/conversations` | `X-Api-Key` | yes | implemented | admin posts a conversation; returns the AI reply |
| GET | `/api/webhooks` | no | no | planned | webhook verification (`hub.challenge`) |
| POST | `/api/webhooks` | HMAC | no | planned | ingest messages + comments |
| GET | `/api/tickets` | yes | no | planned | list via domain API |
| GET | `/api/tickets/:id` | yes | no | planned | detail via domain API |
| POST | `/api/tickets/:id/messages` | yes | yes | planned | **SSE**: routes + responds |
| GET | `/api/tickets/:id/messages` | yes | yes | planned | transcript (MongoDB) |
| POST | `/api/tickets/:id/escalate` | yes | yes | planned | force handoff to an agent |

## Admin conversation API

`POST /api/v1/tickets/:ticketId/conversations` — the admin app posts a conversation scoped to a
ticket and receives the AI reply. Auth: `X-Api-Key` matched against `AI_API_KEYS` (comma-separated,
supports rotation).

The caller sends prior turns as `context_history` and the turn to answer as `latest_message`
(exclusive — do not repeat the latest turn inside the history). The service is Facebook-only, so no
`channel` is sent, and language is **not** supplied — the AI detects it from the conversation.

Request:

```jsonc
{
  "context_history": [                       // optional; defaults to []
    { "external_id": "mid_100", "role": "user",      "body": "Hi po", "sent_at": "2026-09-17T12:58:00Z" },
    { "external_id": "mid_101", "role": "assistant", "body": "Hello po!", "sent_at": "2026-09-17T12:58:10Z" }
  ],
  "latest_message": {
    "external_id": "mid_123",                 // optional; dedupes against prior turns
    "role": "user",                           // user | assistant | system | tool
    "body": "Magkano po ang Click 125?",
    "attachments": [{ "type": "image", "url": "https://..." }], // optional
    "sent_at": "2026-09-17T13:00:00Z"                            // optional
  },
  "customer": { "display_name": "Juan" }      // optional
}
```

Response (`200`):

```jsonc
{
  "success": true,
  "data": {
    "reply": "…",
    "reply_to_external_id": "mid_123",
    "transfer_to_agent": null,   // reserved; always null for now
    "media": null,               // reserved; { kind, url } when present
    "route": "ai",
    "ai_routed": true,
    "language": "Taglish",       // AI-detected: English | Tagalog | Taglish, or null
    "usage": { "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0 }
  }
}
```

- `language` is detected by the AI (concurrently with the reply); a detection failure yields `null`
  and never blocks the reply.
- The reply is not a stored admin message — the admin creates the customer-facing message on its own
  side (its `/send` path, marked as AI-origin).
- Errors: `401 UNAUTHORIZED` (missing/invalid key), `422 VALIDATION_ERROR` (bad payload).
- `route` / `ai_routed` are constant (`ai` / `true`) until rule-based routing and the classifier land.

## SSE protocol

`POST /api/tickets/:id/messages` with `Accept: text/event-stream` emits:

```
event: status   data: {"status":"understanding"}
event: chunk    data: {"chunk":"..."}      (repeated)
event: complete data: {"messageId":"...","threadId":"..."}
event: error    data: {"error":"..."}
```

A keep-alive comment (`: keepalive`) is sent every 15 seconds.

## Mock admin API (dev only)

`src/mock/` mirrors the Laravel admin's `/api/v1` with seeded data, so the service can be developed
and tested without the real admin. It runs as a **separate process/port** (never mounted in this
service's own app, which already owns `/api/v1`):

```bash
npm run mock:admin        # listens on MOCK_ADMIN_API_PORT (default 8000)
```

| method | path | middleware |
|---|---|---|
| GET | `/api/v1/health` | API key + `X-Platform-Access: web\|mobile` |
| GET | `/api/v1/motorcycles` | API key |
| GET | `/api/v1/branches` | API key |
| GET | `/api/v1/ai-response-templates` | API key |

- Auth mirrors the admin: `X-Api-Key` header **or** `?api_key=`; the value is `DOMAIN_API_KEY`.
  Failure → `401 { "error": "Unauthorized or invalid key detected. Failed to access content." }`.
- Success mirrors the admin envelope:
  `{ "success": true, "data": [...], "message": "Motorcycles retrieved.", "meta": { "current_page", "per_page", "total", "last_page" } }`.
- Query filters mirror the admin: `search`, `brand[]`, `status[]`, `variant_type`, `min_srp`,
  `max_srp`, `available`, `sort`, `per_page` (≤50, default 15), `page`.
- Point the service at it with `DOMAIN_API_URL=http://localhost:8000/api`.

## Conventions

- Errors: `{ success: false, error: { code, message } }`.
- Validation failures: **422** with `{ success: false, error: { code: "VALIDATION_ERROR", message, details: { fields } } }`.
- Mutating routes require auth: `/api/v1` uses a shared `X-Api-Key` (`AI_API_KEYS`).
- Webhooks must verify the signature and dedupe by event id.
