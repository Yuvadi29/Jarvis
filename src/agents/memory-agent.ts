import { ChatOpenAI } from "@langchain/openai";
import type { GraphState } from "../graph/state.js";
import { buildMemoryContext } from "../lib/retriever.js";
import { extractAndStore } from "../lib/extractor.js";
import { deleteMemory, listMemories, storeMemory } from "../lib/store.js";

// ─── PRE-node: runs before orchestrator ──────────────────────────────────────
// Retrieves relevant memories and injects them into state
export async function memoryRetrieveNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  const memoryContext = await buildMemoryContext(state.query);

  return {
    activeAgent: "memory-retrieve",
    memoryContext,
    traceSteps: memoryContext.hasMemory
      ? [`🧠 Memory → found ${memoryContext.explicitMemories.length} explicit + silent context`]
      : [`🧠 Memory → no relevant memories found`],
  };
}

// ─── POST-node: runs after synthesizer ───────────────────────────────────────
// Extracts and stores memories from the completed exchange
export async function memoryStoreNode(
  state: GraphState
): Promise<Partial<GraphState>> {
  // Fire and forget — don't block the response
  if (state.finalAnswer) {
    extractAndStore(state.query, state.finalAnswer).catch(console.error);
  }

  return {
    activeAgent: "memory-store",
    traceSteps: ["🧠 Memory → storing exchange"],
  };
}

// ─── Handle special memory queries ───────────────────────────────────────────
// "Jarvis, what do you remember about me?"
// "Jarvis, forget that I work at Google"
// "Jarvis, remember that I prefer dark mode"
const MEMORY_QUERY_PATTERNS = [
  /what do you (know|remember) about me/i,
  /what('s| is) in your memory/i,
  /forget (that|about|my)/i,
  /remember that/i,
  /what have (i|you) told you/i,
  /clear (my|your|all) memor/i,
  /show (me )?(my|your) memor/i,
];

export function isMemoryCommand(query: string): boolean {
  return MEMORY_QUERY_PATTERNS.some((p) => p.test(query));
}

// ─── Memory command handler ───────────────────────────────────────────────────
export async function handleMemoryCommand(
  query: string
): Promise<string> {
  const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });
  const lower = query.toLowerCase();

  // "what do you remember?"
  if (/what do you (know|remember)|show.*memor|what.*told you/i.test(lower)) {
    const all = await listMemories();
    if (all.length === 0) {
      return "I don't have any memories stored yet. As we talk, I'll start learning your preferences and habits.";
    }

    const byKind = {
      fact:         all.filter((m) => m.kind === "fact"),
      preference:   all.filter((m) => m.kind === "preference"),
      habit:        all.filter((m) => m.kind === "habit"),
      conversation: all.filter((m) => m.kind === "conversation"),
    };

    const parts: string[] = [];
    if (byKind.fact.length)
      parts.push(`Facts about you:\n${byKind.fact.map((m) => `  • ${m.content}`).join("\n")}`);
    if (byKind.preference.length)
      parts.push(`Your preferences:\n${byKind.preference.map((m) => `  • ${m.content}`).join("\n")}`);
    if (byKind.habit.length)
      parts.push(`Habits I've noticed:\n${byKind.habit.map((m) => `  • ${m.content}`).join("\n")}`);
    if (byKind.conversation.length)
      parts.push(`Recent topics:\n${byKind.conversation.map((m) => `  • ${m.content}`).join("\n")}`);

    return `Here's what I remember:\n\n${parts.join("\n\n")}`;
  }

  // "forget that I work at Google" → find and delete
  if (/forget/i.test(lower)) {
    const all = await listMemories();
    const target = query.replace(/forget (that|about|my)?/i, "").trim();

    // Ask GPT-4o to identify which memory to delete
    const resp = await llm.invoke([
      {
        role: "system",
        content: "Given a list of memories and a deletion request, return ONLY the ID of the memory to delete, or 'none' if no match.",
      },
      {
        role: "user",
        content: `Delete request: "${target}"\n\nMemories:\n${all.map((m) => `ID: ${m.id} | ${m.content}`).join("\n")}`,
      },
    ]);

    const id = (typeof resp.content === "string" ? resp.content : "").trim();
    if (id && id !== "none" && id.length > 10) {
      await deleteMemory(id);
      return `Done. I've forgotten that.`;
    }
    return `I couldn't find a matching memory to forget. Try being more specific.`;
  }

  // "remember that I prefer dark mode" → store explicitly
  if (/remember that/i.test(lower)) {
    const fact = query.replace(/remember that/i, "").trim();
    await storeMemory({
      kind: "preference",
      content: fact,
      query,
      importance: "high",
      explicitRecall: true,
    });
    return `Got it. I'll remember that ${fact}.`;
  }

  // "clear all memory"
  if (/clear (my|your|all) memor/i.test(lower)) {
    const all = await listMemories();
    await Promise.all(all.map((m) => deleteMemory(m.id)));
    return `Memory cleared. I've forgotten everything. We're starting fresh.`;
  }

  return "I'm not sure what you'd like me to do with my memory. Try: 'what do you remember?', 'forget that...', or 'remember that...'";
}