import "dotenv/config";
import * as readline from "node:readline";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { chat } from "./agent.js";
import { connect, disconnect } from "./mcp-client.js";

async function main() {
  await connect();
  console.log("Connected to MCP servers. Type /quit to exit, /clear to reset history.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let history: ChatCompletionMessageParam[] | undefined;

  const prompt = () => {
    rl.question("you> ", async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed === "/quit") {
        console.log("Goodbye.");
        rl.close();
        await disconnect();
        process.exit(0);
      }

      if (trimmed === "/clear") {
        history = undefined;
        console.log("History cleared.\n");
        prompt();
        return;
      }

      try {
        const result = await chat(trimmed, history);
        history = result.history;
        console.log(`\nassistant> ${result.response}\n`);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`\n[error] ${detail}\n`);
      }

      prompt();
    });
  };

  prompt();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
