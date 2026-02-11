import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { listTools, callTool } from "./mcp-client.js";

const FIREWORKS_API_KEY = process.env["FIREWORKS_API_KEY"];
if (!FIREWORKS_API_KEY) {
  throw new Error("FIREWORKS_API_KEY environment variable is required");
}

const openai = new OpenAI({
  apiKey: FIREWORKS_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
});

const MODEL = "accounts/fireworks/models/deepseek-v3p1";

let cachedTools: ChatCompletionTool[] | null = null;

async function getTools(): Promise<ChatCompletionTool[]> {
  if (cachedTools) return cachedTools;

  const mcpTools = await listTools();
  cachedTools = mcpTools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.inputSchema,
    },
  }));

  return cachedTools;
}

export async function chat(userMessage: string): Promise<string> {
  const tools = await getTools();

  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No response from model");
    }

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    if (!assistantMessage.tool_calls?.length) {
      return assistantMessage.content ?? "";
    }

    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== "function") continue;

      const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

      console.log(`[tool] ${toolCall.function.name}(${JSON.stringify(args)})`);

      const result = await callTool(toolCall.function.name, args);

      const resultText = "content" in result && Array.isArray(result.content)
        ? (result.content as Array<{ type: string; text?: string }>)
            .map((block) => block.text ?? JSON.stringify(block))
            .join("\n")
        : JSON.stringify(result);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultText,
      });
    }
  }
}
