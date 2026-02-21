import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { GraphState, MediaResult } from "../graph/state.js";
import { youtubeSearchTool } from "../tools/media.tool.js";

// ─── Extract results from LangGraph ToolMessage content ───────────────────────
// Tool responses come back as ToolMessage nodes in the message array.
// Their .content is the raw string returned by the tool function.
function extractMediaResults(messages: any[]): MediaResult[] {
  for (const msg of messages) {
    // ToolMessage has _getType() === "tool" or a "tool" role
    const isToolMsg =
      msg._getType?.() === "tool" ||
      msg.role === "tool" ||
      msg.constructor?.name === "ToolMessage";

    if (!isToolMsg) continue;

    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.results) && parsed.results.length > 0) {
        return parsed.results as MediaResult[];
      }
    } catch {
      // not JSON, skip
    }
  }
  return [];
}

// ─── Media Agent Node ─────────────────────────────────────────────────────────
export async function mediaAgentNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  const agent = createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-4o", temperature: 0 }),
    tools: [youtubeSearchTool],
    stateModifier: `You are a media retrieval assistant. You MUST always call a tool.
Rules:
- User wants video / tutorial / "how to" → call search_youtube
- Ambiguous → call search_youtube by default

Do not respond with text only. Always call a tool first.`,
  });

  try {
    const result = await agent.invoke({
      messages: [new HumanMessage(state.query)],
    });

    const mediaResults = extractMediaResults(result.messages);

    // Debug: log message types to help diagnose issues
    if (mediaResults.length === 0) {
      const msgSummary = result.messages.map((m: any) => ({
        type: m._getType?.() ?? m.role ?? "unknown",
        contentSnippet: String(m.content).slice(0, 120),
      }));
      console.error("[media-agent] No results parsed. Messages:", JSON.stringify(msgSummary, null, 2));
    }

    return {
      activeAgent: "media-agent",
      results: { media: mediaResults.length > 0 ? mediaResults : undefined },
      traceSteps: [
        `🎬 Media Agent → found ${mediaResults.length} media item(s)`,
      ],
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Surface the full error so you can see exactly what went wrong
    console.error("[media-agent] Error:", errMsg);
    return {
      activeAgent: "media-agent",
      traceSteps: [`🎬 Media Agent → ✖ ${errMsg}`],
      results: {},
    };
  }
}