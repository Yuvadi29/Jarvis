import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { obsidianTool } from "../tools/obsidian.tool.js";
import type { GraphState, NoteMatch } from "../graph/state.js";

// ─── Notes Agent Node ─────────────────────────────────────────────────────────
export async function notesAgentNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  const agent = createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-4o", temperature: 0 }),
    tools: [obsidianTool],
    stateModifier:
      "You are a notes retrieval assistant. Search the user's Obsidian vault and return the most relevant notes. Always use the search_obsidian_notes tool.",
  });

  try {
    const result = await agent.invoke({
      messages: [new HumanMessage(state.query)],
    });

    // Extract the last message content (the agent's final answer)
    const lastMsg = result.messages[result.messages.length - 1];
    const rawContent =
      typeof lastMsg.content === "string" ? lastMsg.content : JSON.stringify(lastMsg.content);

    // Try to parse structured notes from tool output buried in messages
    let notes: NoteMatch[] = [];
    for (const msg of result.messages) {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      try {
        const parsed = JSON.parse(content);
        if (parsed.matches) {
          notes = parsed.matches;
          break;
        }
      } catch {
        // not JSON, skip
      }
    }

    return {
      activeAgent: "notes-agent",
      results: { notes: notes.length > 0 ? notes : undefined },
      traceSteps: [
        `📝 Notes Agent → found ${notes.length} matching note(s): ${notes.map((n) => n.name).join(", ") || "none"}`,
      ],
      messages: [new HumanMessage(rawContent)],
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      activeAgent: "notes-agent",
      traceSteps: [`📝 Notes Agent → error: ${errMsg}`],
      results: {},
    };
  }
}