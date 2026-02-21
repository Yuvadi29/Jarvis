import { ChatOpenAI } from "@langchain/openai";
import type { GraphState } from "../graph/state.js";

// ─── Synthesizer Node ─────────────────────────────────────────────────────────
// Runs last — takes everything collected by agents and writes a final answer
export async function synthesizerNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0.3 });

  // Build context from all agent results
  const contextParts: string[] = [];

  if (state.results.notes && state.results.notes.length > 0) {
    contextParts.push(
      "=== Notes from Obsidian ===\n" +
        state.results.notes
          .map((n) => `[${n.name}]\n${n.excerpt}`)
          .join("\n\n")
    );
  }

  if (state.results.search && state.results.search.length > 0) {
    contextParts.push(
      "=== Web Search Results ===\n" +
        state.results.search
          .map((s) => `${s.title}\n${s.snippet}\n${s.url}`)
          .join("\n\n")
    );
  }

  if (state.results.media && state.results.media.length > 0) {
    contextParts.push(
      "=== Media Results ===\n" +
        state.results.media
          .map(
            (m) =>
              `${m.type === "video" ? "🎬" : "🖼"} ${m.title}${m.channel ? ` (${m.channel})` : ""}\n${m.url}`
          )
          .join("\n\n")
    );
  }

  if (contextParts.length === 0) {
    return {
      activeAgent: "synthesizer",
      finalAnswer: "No results were found across any of the agents.",
      traceSteps: ["✨ Synthesizer → no results to synthesize"],
    };
  }

  const context = contextParts.join("\n\n");

  const response = await llm.invoke([
    {
      role: "system",
      content:
        "You are a helpful assistant. Given the user's query and results gathered by multiple agents, write a clear, concise, well-organized answer. Reference sources where relevant. Keep it conversational but thorough.",
    },
    {
      role: "user",
      content: `User query: "${state.query}"\n\n${context}\n\nPlease synthesize a final answer.`,
    },
  ]);

  const answer =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  return {
    activeAgent: "synthesizer",
    finalAnswer: answer,
    traceSteps: ["✨ Synthesizer → final answer ready"],
  };
}