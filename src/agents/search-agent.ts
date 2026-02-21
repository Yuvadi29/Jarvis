import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import type { GraphState, SearchResult } from "../graph/state.js";
import { tavilySearchTool } from "../tools/search.tool.js";

// ─── Search Agent Node ────────────────────────────────────────────────────────
export async function searchAgentNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  const agent = createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-4o", temperature: 0 }),
    tools: [tavilySearchTool],
    stateModifier:
      "You are a web research assistant. Use the web_search tool to find current, accurate information. Return a clear answer with sources.",
  });

  try {
    const result = await agent.invoke({
      messages: [new HumanMessage(state.query)],
    });

    // Extract search results from tool call messages
    let searchResults: SearchResult[] = [];
    for (const msg of result.messages) {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      try {
        const parsed = JSON.parse(content);
        if (parsed.results && Array.isArray(parsed.results)) {
          searchResults = parsed.results;
          break;
        }
      } catch {
        // not JSON
      }
    }

    return {
      activeAgent: "search-agent",
      results: { search: searchResults.length > 0 ? searchResults : undefined },
      traceSteps: [
        `🔍 Search Agent → found ${searchResults.length} web result(s)`,
      ],
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      activeAgent: "search-agent",
      traceSteps: [`🔍 Search Agent → error: ${errMsg}`],
      results: {},
    };
  }
}
