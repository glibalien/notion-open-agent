import "dotenv/config";
import express from "express";
import { chat } from "./agent.js";
import { listTools, callTool, connect, disconnect } from "./mcp-client.js";

const app = express();
app.use(express.json());

app.post("/chat", async (req, res) => {
  const { message } = req.body as { message?: string };
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  const response = await chat(message);
  res.json({ response });
});

app.get("/tools", async (_req, res) => {
  const tools = await listTools();
  res.json(tools);
});

app.post("/tool/:name", async (req, res) => {
  const { name } = req.params;
  const { args } = req.body as { args?: Record<string, unknown> };
  const result = await callTool(name, args ?? {});
  res.json(result);
});

const PORT = parseInt(process.env["PORT"] ?? "3001", 10);

async function main() {
  await connect();
  console.log("Connected to Notion MCP server.");

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
