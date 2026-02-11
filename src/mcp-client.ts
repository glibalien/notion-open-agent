import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const NOTION_MCP_URL = process.env["NOTION_MCP_URL"] ?? "https://mcp.notion.com/mcp";

let client: Client | null = null;
let transport: StdioClientTransport | null = null;

export async function connect(): Promise<Client> {
  if (client) return client;

  transport = new StdioClientTransport({
    command: "npx",
    args: ["mcp-remote", NOTION_MCP_URL],
    stderr: "inherit",
  });

  client = new Client({ name: "notion-open-agent", version: "1.0.0" });
  await client.connect(transport);

  return client;
}

export async function listTools() {
  const c = await connect();
  const result = await c.listTools();
  return result.tools;
}

export async function callTool(name: string, args: Record<string, unknown>) {
  const c = await connect();
  return c.callTool({ name, arguments: args });
}

export async function disconnect() {
  if (transport) {
    await transport.close();
    transport = null;
    client = null;
  }
}
