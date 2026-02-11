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
const MAX_ITERATIONS = 10;
const MAX_RESULT_CHARS = 8000;
const TOOL_RETRY_DELAYS = [500, 1000];

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

function truncate(text: string): string {
  if (text.length <= MAX_RESULT_CHARS) return text;
  return text.slice(0, MAX_RESULT_CHARS) +
    `\n\n[Content truncated — original length: ${text.length} chars]`;
}

function extractResultText(result: Awaited<ReturnType<typeof callTool>>): string {
  if ("content" in result && Array.isArray(result.content)) {
    return (result.content as Array<{ type: string; text?: string }>)
      .map((block) => block.text ?? JSON.stringify(block))
      .join("\n");
  }
  return JSON.stringify(result);
}

async function callToolWithRetry(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= TOOL_RETRY_DELAYS.length; attempt++) {
    try {
      const result = await callTool(name, args);
      return truncate(extractResultText(result));
    } catch (err) {
      lastError = err;
      const delay = TOOL_RETRY_DELAYS[attempt];
      if (delay !== undefined) {
        console.error(`[tool] ${name} failed (attempt ${attempt + 1}), retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  const msg = lastError instanceof Error ? lastError.message : String(lastError);
  return `[Tool call failed after ${TOOL_RETRY_DELAYS.length + 1} attempts: ${msg}]`;
}

export async function chat(userMessage: string): Promise<string> {
  const tools = await getTools();

  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await openai.chat.completions.create({
        model: MODEL,
        messages,
        tools,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(`Fireworks API error: ${detail}`);
    }

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

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
      } catch {
        console.error(`[tool] Malformed arguments for ${toolCall.function.name}: ${toolCall.function.arguments}`);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `[Error: malformed tool call arguments — could not parse JSON: ${toolCall.function.arguments}]`,
        });
        continue;
      }

      const start = Date.now();
      console.log(`[tool] ${toolCall.function.name}(${JSON.stringify(args)})`);

      const resultText = await callToolWithRetry(toolCall.function.name, args);

      console.log(`[tool] ${toolCall.function.name} → ${resultText.length} chars in ${Date.now() - start}ms`);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultText,
      });
    }
  }

  return "[Agent stopped — reached maximum iteration limit]";
}
