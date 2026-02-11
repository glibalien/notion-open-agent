import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const NAMESPACE_SEP = "__";

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

interface McpServersFile {
  servers: Record<string, McpServerConfig>;
}

interface ConnectedServer {
  name: string;
  config: McpServerConfig;
  client: Client;
  transport: StdioClientTransport;
}

export interface NamespacedTool {
  name: string;
  namespacedName: string;
  serverName: string;
  description?: string | undefined;
  inputSchema: {
    type: "object";
    [key: string]: unknown;
  };
}

const connectedServers = new Map<string, ConnectedServer>();

function loadConfig(): McpServersFile {
  const configPath = resolve(process.cwd(), "mcp-servers.json");
  const raw = readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as McpServersFile;
}

async function connectServer(name: string, config: McpServerConfig): Promise<void> {
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    stderr: "inherit",
  });

  const client = new Client({ name: `notion-open-agent-${name}`, version: "1.0.0" });
  await client.connect(transport);

  connectedServers.set(name, { name, config, client, transport });
  console.log(`[mcp] Connected to server: ${name}`);
}

async function reconnectServer(name: string): Promise<void> {
  const server = connectedServers.get(name);
  if (!server) throw new Error(`Unknown MCP server: ${name}`);

  try {
    await server.transport.close();
  } catch {
    // ignore cleanup errors
  }

  connectedServers.delete(name);
  await connectServer(name, server.config);
}

async function withReconnect<T>(
  serverName: string,
  operation: (c: Client) => Promise<T>,
): Promise<T> {
  const server = connectedServers.get(serverName);
  if (!server) throw new Error(`MCP server not connected: ${serverName}`);

  try {
    return await operation(server.client);
  } catch (err) {
    if (err instanceof McpError) throw err;
    console.error(`[mcp:${serverName}] Connection error, attempting reconnect...`, err);
    await reconnectServer(serverName);
    const reconnected = connectedServers.get(serverName);
    if (!reconnected) throw new Error(`Failed to reconnect to ${serverName}`);
    return await operation(reconnected.client);
  }
}

function parseNamespacedName(namespacedName: string): { serverName: string; toolName: string } {
  const sepIndex = namespacedName.indexOf(NAMESPACE_SEP);
  if (sepIndex === -1) {
    throw new Error(
      `Invalid tool name "${namespacedName}" — expected format: serverName${NAMESPACE_SEP}toolName`,
    );
  }
  return {
    serverName: namespacedName.slice(0, sepIndex),
    toolName: namespacedName.slice(sepIndex + NAMESPACE_SEP.length),
  };
}

export async function connectAll(): Promise<void> {
  const config = loadConfig();
  const entries = Object.entries(config.servers);

  if (entries.length === 0) {
    throw new Error("No MCP servers configured in mcp-servers.json");
  }

  await Promise.all(
    entries.map(async ([name, serverConfig]) => {
      if (connectedServers.has(name)) return;
      await connectServer(name, serverConfig);
    }),
  );
}

export async function listTools(): Promise<NamespacedTool[]> {
  const allTools: NamespacedTool[] = [];

  for (const [serverName] of connectedServers) {
    const tools = await withReconnect(serverName, async (c) => {
      const result = await c.listTools();
      return result.tools;
    });

    for (const tool of tools) {
      allTools.push({
        name: tool.name,
        namespacedName: `${serverName}${NAMESPACE_SEP}${tool.name}`,
        serverName,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }
  }

  return allTools;
}

export async function callTool(namespacedName: string, args: Record<string, unknown>) {
  const { serverName, toolName } = parseNamespacedName(namespacedName);
  return withReconnect(serverName, (c) => c.callTool({ name: toolName, arguments: args }));
}

export async function disconnectAll(): Promise<void> {
  for (const [name, server] of connectedServers) {
    try {
      await server.transport.close();
      console.log(`[mcp] Disconnected from server: ${name}`);
    } catch (err) {
      console.error(`[mcp] Error disconnecting ${name}:`, err);
    }
  }
  connectedServers.clear();
}

// Backward-compatible aliases
export const connect = connectAll;
export const disconnect = disconnectAll;
