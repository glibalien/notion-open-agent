import "dotenv/config";
import express from "express";
import { chat } from "./agent.js";
import { listTools, callTool, connect, disconnect } from "./mcp-client.js";

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.post("/chat", async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const start = Date.now();
  console.log(`[chat] message: ${message}`);

  try {
    const { response } = await chat(message);
    console.log(`[chat] done — ${response.length} chars in ${Date.now() - start}ms`);
    res.json({ response });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[chat] error after ${Date.now() - start}ms: ${detail}`);
    res.status(502).json({ error: detail });
  }
});

app.get("/tools", async (_req, res) => {
  try {
    const tools = await listTools();
    res.json(tools);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[tools] error: ${detail}`);
    res.status(502).json({ error: detail });
  }
});

app.post("/tool/:name", async (req, res) => {
  const { name } = req.params;
  const { args } = req.body as { args?: Record<string, unknown> };

  const start = Date.now();
  console.log(`[tool] calling ${name} with args: ${JSON.stringify(args ?? {})}`);

  try {
    const result = await callTool(name, args ?? {});
    console.log(`[tool] ${name} → done in ${Date.now() - start}ms`);
    res.json(result);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[tool] ${name} error after ${Date.now() - start}ms: ${detail}`);
    res.status(502).json({ error: detail });
  }
});

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

async function main() {
  await connect();
  console.log("Connected to MCP servers.");

  const server = app.listen(PORT, () => {
    console.log(`Listening on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    console.log("\nShutting down...");
    server.close();
    await disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
