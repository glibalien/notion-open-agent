# notion-open-agent

A local agent that connects open-weight LLMs to Notion (and other MCP servers) via tool calling. Uses DeepSeek V3.1 through Fireworks.ai's OpenAI-compatible API and connects to Notion's cloud MCP server via `mcp-remote`.

## Features

- Agentic tool-calling loop with DeepSeek V3.1
- Multi-turn conversation history
- Interactive TUI chat and HTTP API
- Multi-MCP server support via registry config
- Retry logic, content truncation, and error recovery

## Setup

```bash
npm install
```

Create a `.env` file:

```
FIREWORKS_API_KEY=your-fireworks-api-key
```

The Notion MCP server is configured in `mcp-servers.json`. On first connection, `mcp-remote` will open your browser for Notion OAuth authorization and cache the tokens.

## Usage

### Interactive chat (TUI)

```bash
npm run chat
```

Type messages to chat with the agent. It maintains conversation history across turns. Commands:
- `/clear` — Reset conversation history
- `/quit` — Exit

### HTTP API

```bash
npm start
```

Starts the server on `http://localhost:3001` (configurable via `PORT` env var).

| Endpoint | Method | Body | Response |
|---|---|---|---|
| `/chat` | POST | `{ "message": "..." }` | `{ "response": "..." }` |
| `/tools` | GET | — | Array of available tool schemas |
| `/tool/:name` | POST | `{ "args": { ... } }` | Tool call result |

Tool names in `/tool/:name` use namespaced format: `notion__toolName`.

## Configuration

### `mcp-servers.json`

Registry of MCP servers. Each server has a command and args to spawn:

```json
{
  "servers": {
    "notion": {
      "command": "npx",
      "args": ["mcp-remote", "https://mcp.notion.com/mcp"]
    }
  }
}
```

To add another MCP server, add an entry to `servers`.

### `system-prompt.txt`

System prompt sent to the LLM on every request. Edit to customize the agent's behavior.

### `.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `FIREWORKS_API_KEY` | Yes | — | Fireworks.ai API key |
| `PORT` | No | `3001` | HTTP server port |

## Development

```bash
npx tsc --noEmit        # Type-check
npx tsx src/test-connection.ts  # Test MCP connections
```
