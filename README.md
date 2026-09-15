# MotorCentral Omnichannel AI

An AI service built with TypeScript + Express + LangGraph. It ingests messages and comments,
turns them into tickets, routes each ticket to **AI or a human agent**, and lets the AI **escalate
to an agent** based on the conversation.

## Documentation

- Architecture: [docs/architecture.md](docs/architecture.md)
- Environment / setup: [docs/environment.md](docs/environment.md)
- Routes / API: [docs/routes.md](docs/routes.md)
- Testing: [docs/testing.md](docs/testing.md)
- Coding conventions: [AGENTS.md](AGENTS.md)

## Quick start

```bash
nvm use                 # Node 22
npm install
cp .env.example .env    # fill in values
docker compose up -d    # mongo + redis + typesense
npm run dev             # http://localhost:3001
```

## Scope

- **Owns:** conversation state (MongoDB), jobs/cache (Redis), search index (Typesense).
- **Does not own:** tickets / agents / SLA — those live in the Laravel admin (MySQL) and are reached
  through the Laravel API. There is no ORM in this service.
