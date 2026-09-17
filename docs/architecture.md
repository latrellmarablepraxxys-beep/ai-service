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
- **Mock admin API (dev only):** `src/mock/` mirrors the Laravel admin's `/api/v1`
  (`health`, `motorcycles`, `branches`, `ai-response-templates`, `knowledge-entries`,
  `escalation-topics`, `promotions`) with seeded data so the
  service can be developed without the real admin. Runs standalone via `npm run mock:admin`
  on `MOCK_ADMIN_API_PORT` (default 8000) — never mounted in this service's own app.

## Request flow

Implemented turn flow (Phase 1 — `POST /api/v1/tickets/:ticketId/conversations` via
`ConversationService` → `TurnPipeline.execute` in `src/services/turn/`):

```text
persist inbound (dedupe by external_id) -> load state (thread + conversation_state + history)
  -> fetch escalation topics (KnowledgeService, Redis-cached)
  -> EscalationGuard: deterministic whole-phrase match on the latest USER message only
     -> hit: ESCALATE without any LLM call (guard decision carries the topic's fallbackTemplateKey)
     -> miss: BuildPrompt -> LLM chat (responseFormat: json_object) + concurrent language detection
  -> ValidateAndApply: parse wire schema -> post-checks -> render template server-side
  -> persist run (Completed) + decision + conversation_state + assistant message (+ escalation record when escalated)
  -> respond (route flips to 'agent', transfer_to_agent: true on escalation)
```

A run that throws mid-turn is marked `Failed` and the error rethrown — never `Completed`
with a partial turn.

Target flow (webhooks / ticket jobs — not yet routed):

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
| Threads, messages, memories, runs, conversation_states, decisions, escalations | MongoDB | `mongodb` driver |
| Jobs, cache | Redis | ioredis / BullMQ |
| KB / FAQ / CMS index | Typesense | `typesense` client |
| Tickets, agents, SLA | Laravel (MySQL) | Laravel API |

## Key decisions

- **LangGraph** for explicit, testable flows (routing + escalation).
- **Provider-agnostic LLM** — `@langchain/openai` against OpenAI-compatible endpoints. `AI_PROVIDER` selects `openai` / `ollama` / `novita`; each provider has a preset in `src/config/aiProviders.ts` overridable by its `*_BASE_URL` / `*_API_KEY` / `*_MODEL` env vars. All normalize to one `AiProviderConfig` shape.
- **No ORM** — domain persistence is the Laravel API's job.
- **Idempotent webhooks** — dedupe by event/message id before creating tickets.
- **Shared Redis** — Redis is shared with the Laravel admin, so BullMQ queue names must be prefixed with `redisConfig.queuePrefix` (cache keys are already namespaced in `redisCacheClient`).
- **Deterministic escalation dual-control** — the guard (`EscalationGuard.ts`, whole-phrase match on
  the latest user message) and the validator's guard-wins coercion (`DecisionValidator.ts`) both
  force `Escalate` with the topic's `fallbackTemplateKey`. The LLM can propose escalation, but only
  for a known topic; an unknown-topic escalation degrades to the fallback line.
- **Server-side template rendering** — the LLM emits a `template_key` plus a `{{template}}` marker;
  `ValidateAndApply.ts` renders amounts, terms, and freebie lists from live knowledge and replaces
  LLM-provided attachment URLs with pipeline-built ones, so the model never smuggles untrusted URLs
  or invented prices into a reply.
- **Degraded escalation seed** — `KnowledgeService.getEscalationTopics()` falls back to the frozen
  `DEGRADED_ESCALATION_TOPICS` on transport/5xx failures only (connection, timeout, 5xx); auth,
  validation, and other 4xx errors rethrow so revoked keys and contract breaks stay visible.
- **Versioned domain baseUrl** — `domainConfig.baseUrl` must be the versioned root
  (`http://localhost:8000/api/v1`); `DomainHttpClient` appends resource paths directly, so a bare
  `/api` base double-nests every request.
