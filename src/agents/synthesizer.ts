import { ChatOpenAI } from "@langchain/openai";
import type { GraphState } from "../graph/state";
import { formatExplicitRecalls } from "../lib/retriever";

export async function synthesizerNode(state: GraphState): Promise<Partial<GraphState>> {
  const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0.3 });

  // ── Build context from agent results ────────────────────────────────────────
  const contextParts: string[] = [];

  if (state.results.notes?.length)
    contextParts.push(
      "=== Personal Notes ===\n" +
      state.results.notes.map((n) => `[${n.name}]\n${n.excerpt}`).join("\n\n")
    );

  if (state.results.search?.length)
    contextParts.push(
      "=== Web Search ===\n" +
      state.results.search.map((s) => `${s.title}\n${s.snippet}\n${s.url}`).join("\n\n")
    );

  if (state.results.media?.length)
    contextParts.push(
      "=== Media ===\n" +
      state.results.media.map((m) =>
        `${m.type === "video" ? "Video" : "Image"}: ${m.title}${m.channel ? ` by ${m.channel}` : ""}\n${m.url}`
      ).join("\n\n")
    );

  if (state.results.browser)
    contextParts.push("=== Browser Result ===\n" + state.results.browser.summary);

  // ── Build memory enrichment ──────────────────────────────────────────────────
  const { memoryContext } = state;
  const explicitRecalls = formatExplicitRecalls(memoryContext?.explicitMemories ?? []);

  // ── System prompt with silent memory baked in ────────────────────────────────
  const systemPrompt = [
    `You are Jarvis, a sharp, intelligent AI assistant.`,
    `Synthesize the gathered information into a clear, helpful response.`,
    `Be conversational but precise. Avoid markdown formatting.`,
    explicitRecalls
      ? `\nWhen relevant, naturally reference these memories:\n${explicitRecalls}`
      : "",
    memoryContext?.silentContext
      ? `\n${memoryContext.silentContext}`
      : "",
  ].filter(Boolean).join("\n");

  if (contextParts.length === 0 && !explicitRecalls) {
    return {
      activeAgent: "synthesizer",
      finalAnswer: "I wasn't able to find anything relevant for that.",
      traceSteps: ["✨ Synthesizer → no results"],
    };
  }

  const response = await llm.invoke([
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `User query: "${state.query}"\n\n${contextParts.join("\n\n")}`,
    },
  ]);

  const answer = typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);

  return {
    activeAgent: "synthesizer",
    finalAnswer: answer,
    traceSteps: ["✨ Synthesizer → answer ready"],
  };
}