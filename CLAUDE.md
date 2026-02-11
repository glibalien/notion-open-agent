# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

notion-open-agent is a local HTTP API server that bridges DeepSeek V3.1 (via Fireworks.ai's OpenAI-compatible API) to Notion's cloud MCP server. It spawns `mcp-remote` as a subprocess to connect to Notion MCP via stdio transport, runs an agentic tool-calling loop against Fireworks, and exposes the result over Express HTTP endpoints.

## Commands

- `npm start` — Run the server (uses tsx, no build step needed)
- `npx tsx src/test-connection.ts` — Test MCP connection and list available Notion tools
- `npx tsc --noEmit` — Type-check without emitting

No test framework is configured yet.

## Architecture

```
HTTP Client → Express (server.ts) → Agent Loop (agent.ts) → Fireworks/DeepSeek V3.1
                                          ↕
                                    MCP Client (mcp-client.ts) → mcp-remote subprocess → Notion MCP
```

**server.ts** — Entry point. Loads dotenv, sets up Express with three endpoints (`POST /chat`, `GET /tools`, `POST /tool/:name`), manages graceful shutdown.

**agent.ts** — Agentic loop. Fetches MCP tool schemas, converts them to OpenAI function-calling format, sends user messages to DeepSeek via Fireworks, executes any returned tool calls via MCP, and loops until the model produces a final text response. Exports `chat(userMessage)`.

**mcp-client.ts** — Singleton MCP connection. Spawns `npx mcp-remote <url>` as a child process, connects via the MCP SDK's `StdioClientTransport`. Exports `connect()`, `listTools()`, `callTool()`, `disconnect()`. The `mcp-remote` process handles Notion OAuth automatically (browser-based auth on first run, cached tokens thereafter).

## Environment Variables

Loaded from `.env` via dotenv:

- `FIREWORKS_API_KEY` (required) — Fireworks.ai API key
- `NOTION_MCP_URL` (optional) — defaults to `https://mcp.notion.com/mcp`
- `PORT` (optional) — defaults to `3001`

## TypeScript

- Module system: `node16` — use `.js` extensions in relative imports
- Strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- Source in `src/`, compiled output in `dist/` (though dev uses tsx directly)
