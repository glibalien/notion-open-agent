import { connect, listTools, disconnect } from "./mcp-client.js";

async function main() {
  console.log("Connecting to MCP servers...");
  await connect();
  console.log("Connected. Listing tools...\n");

  const tools = await listTools();
  for (const tool of tools) {
    console.log(`- ${tool.namespacedName} (${tool.serverName})`);
  }
  console.log(`\n${tools.length} tools available.`);

  await disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
