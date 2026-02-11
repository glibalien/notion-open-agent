# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Does

notion-open-agent is a local agent that bridges DeepSeek V3.1 (via Fireworks.ai's OpenAI-compatible API) to MCP servers (currently Notion). It provides both an HTTP API and an interactive TUI for multi-turn conversations with tool-calling capabilities.

## Commands

- `npm start` — Run the HTTP server (uses tsx, no build step needed)
- `npm run chat` — Run the interactive TUI chat
- `npx tsx src/test-connection.ts` — Test MCP connections and list available tools
- `npx tsc --noEmit` — Type-check without emitting

No test framework is configured yet.

## Architecture

```
HTTP Client → Express (server.ts) ──→ Agent Loop (agent.ts) → Fireworks/DeepSeek V3.1
TUI (tui.ts) ───────────────────────→       ↕
                                      MCP Registry (mcp-client.ts)
                                        ├── notion → mcp-remote → Notion MCP
                                        └── (future servers)
```

**server.ts** — HTTP entry point. Loads dotenv, sets up Express with three endpoints (`POST /chat`, `GET /tools`, `POST /tool/:name`), request logging middleware, and graceful shutdown.

**tui.ts** — Interactive terminal entry point. readline-based chat loop with multi-turn conversation history. Supports `/quit` and `/clear` commands.

**agent.ts** — Agentic tool-calling loop. Loads system prompt from `system-prompt.txt`. Converts MCP tool schemas to OpenAI function-calling format (using namespaced tool names). Loops: send messages to DeepSeek, execute tool calls, feed results back. Exports `chat(userMessage, history?)` returning `ChatResult { response, history }` for multi-turn support.

**mcp-client.ts** — Multi-server MCP registry. Loads server configs from `mcp-servers.json`. Manages named connections with per-server reconnect logic. Tools are namespaced as `serverName__toolName` (split on first `__` only to handle tool names containing `__`). Exports `connect()`, `listTools()`, `callTool()`, `disconnect()`.

## Configuration Files

**`mcp-servers.json`** — Registry of MCP servers. Each entry has a name, command, and args. Adding a new MCP server is just adding an entry here.

**`system-prompt.txt`** — System prompt sent to the LLM. Guides efficient tool usage. Loaded at startup with a fallback default if missing.

**`.env`** — Environment variables loaded via dotenv.

## Robustness

**Tool call retries** — Failed tool calls are retried up to 2 times with 500ms/1000ms delays. MCP `-32602` (invalid arguments) errors skip retries and feed the error back to DeepSeek so it can self-correct.

**Content truncation** — Tool results exceeding 8000 chars are truncated with a note appended.

**Iteration limit** — The agentic loop caps at 10 iterations to prevent infinite loops.

**MCP auto-reconnect** — `withReconnect()` in mcp-client.ts retries on transport/connection failures (reconnects the subprocess). MCP application errors (`McpError`) are passed through without reconnecting.

**DeepSeek 400 fallback** — If Fireworks returns a 400 on a follow-up turn (the known `tool_calls_end` token issue), the agent synthesizes a response from collected tool results instead of crashing.

**Error handling** — All HTTP endpoints return `{ error: string }` with 502 status on upstream failures. Malformed tool call arguments from DeepSeek are caught and fed back as tool results.

## Environment Variables

Loaded from `.env` via dotenv:

- `FIREWORKS_API_KEY` (required) — Fireworks.ai API key
- `PORT` (optional) — defaults to `3001`

## TypeScript

- Module system: `node16` — use `.js` extensions in relative imports
- Strict mode with `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`
- Source in `src/`, compiled output in `dist/` (though dev uses tsx directly)
