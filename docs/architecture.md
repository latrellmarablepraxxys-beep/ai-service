# Architecture

> `motorcentral-omnichannel-ai` is a TypeScript + Express + LangGraph service. The flows below describe how it works.

## Context

The service ingests messages and comments, creates tickets, routes them to AI or a human, and
escalates on conversation signals. It owns only conversation state; the Laravel admin
owns tickets, agents, and SLA.

## Components

- **API (Express):** webhooks, tickets, health, metrics, SSE.
- **Orchestration (LangGraph):** routing graph + escalation graph.
- **Services:** LLM provider, domain clients (admin API), Typesense, cache.
- **Ports (`src/interfaces/`):** type-only contracts (LLM, domain, persistence, search, cache) implemented by services and fakes.
- **Persistence:** MongoDB repositories; Redis for jobs/cache.
- **Jobs (BullMQ):** async routing / response / escalation.

## Request flow

```text
External channels (messages / comments)
  ├─ messages ─┐
  └─ comments ─┤  webhook: verify (hub.challenge) + HMAC + dedupe
               ▼
        normalize -> InboundEvent
               ▼
        ticket upsert (Laravel API)
               ▼
        enqueue route-ticket job
               ▼
        ROUTING graph
          rules node ──(trigger)──▶ route
               │                      ├─ ai    -> generate response (SSE) -> save msg (Mongo)
               └──(else)──▶ AI classify └─ agent -> assign via Laravel API
               ▼
        after each AI turn: ESCALATION graph
          escalation policy ──(trigger)──▶ escalate -> handoff (summary + context) -> Laravel API
```

## Data ownership

| Data | Store | Access |
|---|---|---|
| Threads, messages, memories, runs | MongoDB | `mongodb` driver |
| Jobs, cache | Redis | ioredis / BullMQ |
| KB / FAQ / CMS index | Typesense | `typesense` client |
| Tickets, agents, SLA | Laravel (MySQL) | Laravel API |

## Key decisions

- **LangGraph** for explicit, testable flows (routing + escalation).
- **Provider-agnostic LLM** — `@langchain/openai` against OpenAI-compatible endpoints. `AI_PROVIDER` selects `openai` / `ollama` / `novita`; each provider has a preset in `src/config/aiProviders.ts` overridable by its `*_BASE_URL` / `*_API_KEY` / `*_MODEL` env vars. All normalize to one `AiProviderConfig` shape.
- **No ORM** — domain persistence is the Laravel API's job.
- **Idempotent webhooks** — dedupe by event/message id before creating tickets.
- **Shared Redis** — Redis is shared with the Laravel admin, so BullMQ queue names must be prefixed with `redisConfig.queuePrefix` (cache keys are already namespaced in `redisCacheClient`).
