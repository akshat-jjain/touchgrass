# TouchGrass

> An AI that wants you to stop using it.

TouchGrass creates short outdoor micro-adventures so the screen is the shortest part of going outside. It is being built for the DEV Hacktoberfest 2026 Week 1 “Touch Grass” challenge.

## Local development

Requirements: Node.js 22.12 or later and npm 10 or later.

```sh
npm ci
cp .env.example .env
npm run dev
```

The web app runs at `http://localhost:5173`; the API runs at `http://localhost:3000`. Vite proxies `/api` requests to Fastify. The API health endpoint is `GET /health`.

## Adventure generation

The API supports two server-side providers:

- `AI_PROVIDER=stub` uses the curated deterministic generator. It is the default for local development and tests.
- `AI_PROVIDER=groq` uses Groq’s OpenAI-compatible chat completions API and `openai/gpt-oss-20b` by default. Set `GROQ_API_KEY` on the server. The key must never use a `VITE_` prefix or be placed in browser code.

The Groq generator requests strict JSON Schema output. All provider results are still checked against the shared Zod response contract and deterministic server safety rules. If Groq times out, is unavailable, is rate limited, or returns invalid or unsafe content, the server uses the safe stub for that request. Responses include an `x-adventure-provider` header; fallback responses also include `x-adventure-fallback: true`, so a stub response is never reported as model generated.

Example Groq settings:

```env
AI_PROVIDER=groq
GROQ_API_KEY=your-server-side-key
GROQ_MODEL=openai/gpt-oss-20b
GROQ_TIMEOUT_MS=15000
```

For Render, add these in the service’s Environment settings. Keep `GROQ_API_KEY` secret and add no AI key to the frontend build environment. If no key is present while Groq is selected, the server logs a warning and starts with the stub.

## Workspace

```text
apps/web           React + Vite client
apps/api           Fastify API, safety checks, and generation providers
packages/contracts Shared Zod schemas and inferred TypeScript types
```

There is no database. Preferences and the current adventure are stored in browser `localStorage` after validation.

## Scripts

| Command                | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Start the API and Vite development servers            |
| `npm run build`        | Build contracts, frontend, and API                    |
| `npm run typecheck`    | Type-check all workspaces                             |
| `npm run lint`         | Lint the repository                                   |
| `npm test`             | Run API and frontend tests                            |
| `npm start`            | Start the production API and serve the built frontend |
| `npm run format:check` | Check Prettier formatting                             |

## Deployment

`render.yaml` configures one Render Free web service. Its build creates the shared contracts, static frontend, and API; Fastify serves the frontend and `/health`. Render provides `PORT`. To use Groq on the deployed service, set `AI_PROVIDER=groq` and add `GROQ_API_KEY` in Render’s environment settings. Free-tier limits, cold starts, and provider usage limits apply; ₹0 operation is a target within those limits, not a guarantee of unlimited usage.

## Challenge

Built for the [DEV Hacktoberfest 2026 Week 1 challenge](https://dev.to/events/challenges/hacktoberfest-week1-2026-10-05). The submission uses `#hf26challenge`.

## License

MIT. See [LICENSE](LICENSE).
