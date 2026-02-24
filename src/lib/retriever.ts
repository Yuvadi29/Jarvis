
// ─── Build memory context for a given query ───────────────────────────────────

import { retrieveMemories } from "./store";
import { MemoryContext, RetrievedMemory } from "./types";

// Called before the orchestrator runs — enriches the query with past context
export async function buildMemoryContext(query: string): Promise<MemoryContext> {
  try {
    const memories = await retrieveMemories(query, {
      limit: 10,
      minScore: 0.55,
    });

    if (memories.length === 0) {
      return { silentContext: "", explicitMemories: [], hasMemory: false };
    }

    // Split into silent vs explicit
    const explicit = memories.filter((m) => m.explicitRecall && m.importance !== "low");
    const silent   = memories.filter((m) => !m.explicitRecall || m.importance === "low");

    // Build silent context block (injected into system prompt)
    const silentContext = silent.length > 0
      ? `[Background context about the user — use naturally, don't mention you remembered this]\n` +
        silent.map((m) => `• ${m.content}`).join("\n")
      : "";

    console.log(
      `[memory] 🔍 Retrieved ${memories.length} memories ` +
      `(${explicit.length} explicit, ${silent.length} silent)`
    );

    return {
      silentContext,
      explicitMemories: explicit,
      hasMemory: memories.length > 0,
    };
  } catch (err) {
    console.error("[memory] Retrieval failed:", err);
    return { silentContext: "", explicitMemories: [], hasMemory: false };
  }
}

// ─── Format explicit memories for Jarvis to mention in response ───────────────
export function formatExplicitRecalls(memories: RetrievedMemory[]): string {
  if (memories.length === 0) return "";

  return memories
    .map((m) => {
      switch (m.kind) {
        case "fact":       return `Based on what you told me: ${m.content}`;
        case "preference": return `Remembering your preference: ${m.content}`;
        case "habit":      return `I've noticed: ${m.content}`;
        default:           return `From our previous conversations: ${m.content}`;
      }
    })
    .join("\n");
}