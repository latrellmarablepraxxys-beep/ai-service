# Environment

## Local services (docker compose)

| Service | Port | Purpose |
|---|---|---|
| MongoDB | 27017 | conversation state (threads, messages, memories, runs) |
| Redis | 6379 | cache + BullMQ queues |
| Typesense | 8108 | search / RAG index |

Start them: `docker compose up -d`

## Variables

| var | purpose |
|---|---|
| `NODE_ENV` | development / test / production |
| `PORT` | HTTP port (default 3001) |
| `APP_URL` | public base URL of this service (empty → `http://localhost:$PORT`) |
| `FRONTEND_URL` | CORS origin |
| `TRUST_PROXY` | Express `trust proxy` setting (empty = direct connections; `true`/`false` or a hop count string, e.g. `1`). Required behind a load balancer so client IPs (and rate-limit buckets) are correct |
| `DOMAIN_API_URL` | domain admin API base URL (tickets/agents/SLA) |
| `DOMAIN_API_KEY` | service key sent as `X-Api-Key` |
| `DOMAIN_API_TIMEOUT_MS` | request timeout |
| `AI_API_KEYS` | comma-separated API keys accepted on `/api/v1` (admin app sends one as `X-Api-Key`); required in production |
| `AI_PROVIDER` | active provider selector (`openai` | `ollama` | `novita`, default `openai`) |
| `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_CHAT_MODEL` / `OPENAI_CLASSIFIER_MODEL` / `OPENAI_EMBEDDING_MODEL` | openai overrides (empty → preset) |
| `OLLAMA_BASE_URL` / `OLLAMA_API_KEY` / `OLLAMA_CHAT_MODEL` / `OLLAMA_CLASSIFIER_MODEL` / `OLLAMA_EMBEDDING_MODEL` | ollama overrides (empty → preset; no key needed) |
| `NOVITA_BASE_URL` / `NOVITA_API_KEY` / `NOVITA_CHAT_MODEL` / `NOVITA_CLASSIFIER_MODEL` / `NOVITA_EMBEDDING_MODEL` | novita overrides (empty → preset) |
| `EMBEDDING_BASE_URL` | dedicated embeddings endpoint (empty → active provider's baseUrl) |
| `EMBEDDING_API_KEY` | embeddings endpoint key (empty → active provider's apiKey) |
| `EMBEDDING_MODEL` | embeddings model id (empty → active provider's embedding model) |
| `EMBEDDING_DIMENSIONS` | vector size emitted by the embedding model (default 1024; must match the Typesense vector field) |

### AI provider presets (`src/config/aiProviders.ts`)

| provider | base URL | apiKey preset | chat / classifier / embedding |
|---|---|---|---|
| openai | `https://api.openai.com/v1` | — | `gpt-4o-mini` / `gpt-4o-mini` / `text-embedding-3-small` |
| ollama | `http://localhost:11434/v1` | `ollama` | `llama3.2` / `llama3.2` / `nomic-embed-text` |
| novita | `https://api.novita.ai/v3/openai` | — | `deepseek/deepseek-v3` / same / `openai/text-embedding-3-small` |
| `MONGODB_URI` / `MONGODB_DB` | conversation state (default database: `motorcentral-omnichannel-ai`) |
| `REDIS_URL` | cache + BullMQ (Redis is **shared with the Laravel admin**; BullMQ queue names are namespaced with `redisConfig.queuePrefix`) |
| `REDIS_COMMAND_TIMEOUT_MS` | cache-connection command timeout in ms (default 2000) |
| `TYPESENSE_HOST` / `TYPESENSE_PORT` / `TYPESENSE_PROTOCOL` / `TYPESENSE_API_KEY` | search/RAG |
| `TYPESENSE_COLLECTION_PREFIX` | prefix for this service's collections |
| `TYPESENSE_CONNECTION_TIMEOUT_SECONDS` | Typesense client connection timeout (default 5) |
| `WEBHOOK_VERIFY_TOKEN` | webhook verification token — optional (required once the webhook route lands) |
| `WEBHOOK_SIGNING_SECRET` | webhook HMAC signing secret — optional (required once the webhook route lands) |
| `MOCK_ADMIN_API_PORT` | dev-only mock admin API port (default 8000); start with `npm run mock:admin` |
| `LOG_LEVEL` / `LOG_DIR` | logging |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | rate limiting |

## Setup

```bash
nvm use                 # Node 22
npm install
cp .env.example .env    # fill in values
docker compose up -d
npm run db:setup        # create service-owned collections + indexes (idempotent)
npm run dev             # http://localhost:3001
```

> `npm run typesense:init` (`scripts/initTypesense.ts`) and `npm run db:seed` (`scripts/seed.ts`) are wired and implemented. The search index is shared with the Laravel admin, so Typesense provisioning remains optional today.

> Resets: `npm run db:clear -- --force` deletes all documents (keeps collections + indexes); `npm run db:fresh -- --force` drops and recreates the 4 collections with indexes. Both are destructive and refuse to run under `NODE_ENV=production`.

## Notes

- Config is validated at boot — the process should fail fast on a missing required var.
- Never commit `.env`; only `.env.example` belongs in the repo.
