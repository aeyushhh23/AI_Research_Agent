# AI Research Agent

A full-stack agentic research app built with React, Express, TypeScript, LangGraph, MCP, Gemini, PostgreSQL, and pgvector.

The system is designed to avoid fake demos: research answers, citations, GitHub analysis, memories, and tool outputs must come from configured runtime providers or the database. Missing API keys produce setup errors instead of fabricated results.

## Features

- Arbitrary research questions through a React dashboard
- LangGraph agent workflow with bounded tool use
- Real MCP client/server communication
- Research MCP for web/news search and page fetches
- GitHub MCP for repository metadata, file trees, file reads, code search, and issues
- Memory MCP backed by PostgreSQL and pgvector
- Gemini LLM and embedding provider, configurable by environment
- JWT authentication and protected research resources
- SSE activity stream with safe high-level events
- Source, tool-call, and research-run persistence
- Docker Compose for PostgreSQL/pgvector, backend, and frontend
- Evaluation scaffold for scored research-run assessment

## Architecture

React + Vite + Tailwind routes user actions to the Express API. Express creates authenticated research projects and starts the LangGraph agent. The agent uses an MCP client to call three local MCP servers. Those servers call search providers, GitHub, and PostgreSQL. Results return to the agent, are persisted, and are summarized into a final report.

```text
User -> React -> Express -> LangGraph Agent -> MCP Client
                                      |-> Research MCP -> Search APIs / web fetch
                                      |-> GitHub MCP -> GitHub API
                                      |-> Memory MCP -> PostgreSQL + pgvector
```

## Agentic AI

The workflow is:

START -> understand/retrieve memory -> plan -> select tool -> execute MCP tool -> evaluate evidence -> repeat if needed -> analyze -> extract useful memory -> persist -> END.

Tool choice is model-driven and constrained by an allowlist. `MAX_TOOL_CALLS` and `MAX_RESEARCH_TIME` prevent runaway loops. The frontend only receives high-level activity events, not chain-of-thought.

## MCP

MCP servers live in `mcp-servers/src`:

- `research/server.ts`: `searchWeb`, `fetchWebPage`, `searchNews`
- `github/server.ts`: `getRepository`, `listFiles`, `readFile`, `searchCode`, `getIssues`
- `memory/server.ts`: `saveMemory`, `searchMemory`, `getResearchHistory`, `deleteMemory`

The backend starts these over stdio using `@modelcontextprotocol/sdk`.

## Memory And Vector Search

Short-term memory is LangGraph state for the active run. Long-term memory is stored in the `memories` table with pgvector embeddings. The memory extraction step saves durable preferences or reusable context, not every message.

Memory is not RAG over documents. It is user/project context retrieval that can influence future research style and planning.

## Configuration

Copy `.env.example` to `.env` and set values:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ai_research_agent
JWT_SECRET=replace-with-a-long-random-string
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-flash
GEMINI_API_KEY=your-key
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=text-embedding-004
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=your-search-key
GITHUB_TOKEN=optional-for-higher-rate-limits
MAX_TOOL_CALLS=15
MAX_RESEARCH_TIME=120
```

The core path uses free/no-cost-friendly options: Gemini API access where available, GitHub API, a configurable search provider with developer tiers, local PostgreSQL, and open-source libraries. Provider free tiers can change, so the app keeps providers replaceable.

## Running Locally

```bash
npm install
docker compose up db
npm run migrate
npm run build -w @ai-research-agent/shared
npm run build -w @ai-research-agent/mcp-servers
npm run dev -w backend
npm run dev -w frontend
```

Open `http://localhost:5173`.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

Set real `GEMINI_API_KEY` and search provider keys in `.env` first. Without them, the app will report provider errors honestly.

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/conversations`
- `POST /api/conversations`
- `POST /api/research`
- `GET /api/research`
- `GET /api/research/:id`
- `GET /api/research/:id/sources`
- `GET /api/research/:id/tool-calls`
- `GET /api/research/:id/stream`
- `GET /api/memories`
- `DELETE /api/memories/:id`

All research and memory routes require authentication.

## Testing

```bash
npm test
npm run typecheck
```

External APIs should be mocked only in isolated unit tests. Integration testing should verify real persistence, MCP tool discovery/calls, and failure behavior against configured development services.

## Example Demos

- Research recent developments in RAG.
- Compare PostgreSQL and MongoDB for AI applications.
- Analyze `https://github.com/owner/repository`.
- Remember that you prefer technical reports with comparison tables, then start a new research task.
- Remove a provider key and verify that the app reports a real configuration failure.

## Limitations

- Search quality depends on the configured provider and tier.
- GitHub code search may require a token depending on rate limits and API policy.
- The evaluation scaffold is implemented in code but not yet exposed in the dashboard.
- Production deployment should add stricter rate limiting, HTTPS-only cookies, and centralized logging.
