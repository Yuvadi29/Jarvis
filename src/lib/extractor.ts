import { ChatOpenAI } from "@langchain/openai";
import z from "zod";
import { storeMemory } from "./store";

// Schema for what GPT4-0 extracts from a conversation 
const ExtractionSchema = z.object({
    memories: z.array(
        z.object({
            shouldStore: z.boolean(),
            kind: z.enum(["preference", "habit", "fact", "conversation"]),
            content: z.string().describe("Concise, standalone memory statement"),
            importance: z.enum(["low", "medium", "high"]),
            explicitRecall: z.boolean().describe("True if Jarvis should explicitly mention this memory when recalled")
        }),
    )
});

const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0
}).withStructuredOutput(ExtractionSchema);

// Extract and store memories from a Q&A exchange
export async function extractAndStore(
    query: string,
    answer: string
): Promise<void> {
    try {
        const result = await llm.invoke([
            {
                role: "system",
                content: `You are a memory extraction system for Jarvis, an AI assistant.

Analyze the user's query and Jarvis's response. Extract anything worth remembering long-term.

Memory kinds:
- "preference": user likes/dislikes, preferred formats, style preferences
  Examples: "User prefers concise answers", "User likes dark interfaces", "User uses metric units"
- "habit": recurring patterns in how/when/what they ask
  Examples: "User frequently asks about AI news", "User checks stocks in the morning"
- "fact": explicit personal facts the user stated
  Examples: "User's name is Aditya", "User works in fintech", "User is building a startup"
- "conversation": important topic discussed that may need future context
  Examples: "User is researching LangGraph for a production project"

Importance rules:
- high: personal facts, strong preferences, critical context
- medium: preferences, recurring habits, useful context
- low: minor details, one-off mentions

explicitRecall = true when:
- User told Jarvis something about themselves explicitly ("I am...", "I work at...", "I prefer...")
- Jarvis should say "Based on what you told me..." when recalling this

explicitRecall = false when:
- Silently use as context without mentioning you remembered it
- Behavioral patterns, implied preferences

Only store things with long-term relevance. Skip pleasantries, one-off questions about 
external topics (news, weather), and anything not about the USER themselves.
If nothing is worth storing, return an empty memories array.`,
            },
            {
                role: "user",
                content: `User query: "${query}"\n\nJarvis response: "${answer.slice(0, 800)}"`,
            },
        ]);

        const toStore = result.memories.filter((m) => m.shouldStore);
        if (toStore.length === 0) return;

        // Store all extracted memories in parallel
        await Promise.all(
            toStore.map((m) =>
                storeMemory({
                    kind: m.kind,
                    content: m.content,
                    query,
                    answer: answer.slice(0, 500),
                    importance: m.importance,
                    explicitRecall: m.explicitRecall,
                })
            )
        );

        console.log(`[memory] 🧠 Extracted ${toStore.length} memory item(s)`);
    } catch (err) {
        // Memory extraction should never crash the main flow
        console.error("[memory] Extraction failed:", err);
    }
}
