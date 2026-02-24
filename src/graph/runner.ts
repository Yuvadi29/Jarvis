import "dotenv/config";
import { buildGraph } from "./graph.js";
import type { GraphState } from "./state.js";
import { handleMemoryCommand, isMemoryCommand } from "../agents/memory-agent";

let _graph: ReturnType<typeof buildGraph> | null = null;
function getGraph() {
  if (!_graph) _graph = buildGraph();
  return _graph;
}

export async function runQuery(
  query: string,
  onStep?: (step: string) => void
): Promise<GraphState> {
  // ── Intercept memory commands before the graph ────────────────────────────
  if (isMemoryCommand(query)) {
    onStep?.("🧠 Memory → handling memory command");
    const answer = await handleMemoryCommand(query);

    // Return a minimal GraphState-shaped object
    return {
      query,
      finalAnswer: answer,
      messages: [],
      results: {},
      traceSteps: ["🧠 Memory → command handled"],
      agentQueue: [],
      intent: null,
      activeAgent: "memory",
      memoryContext: { silentContext: "", explicitMemories: [], hasMemory: false },
    } as GraphState;
  }

  // ── Normal graph run ──────────────────────────────────────────────────────
  const graph = getGraph();
  const initialState: Partial<GraphState> = {
    query,
    messages: [],
    results: {},
    traceSteps: [],
    agentQueue: [],
    intent: null,
    activeAgent: "idle",
    finalAnswer: "",
    memoryContext: { silentContext: "", explicitMemories: [], hasMemory: false },
  };

  let finalState: GraphState | null = null;
  const seenSteps = new Set<string>();

  const stream = await graph.stream(initialState, { streamMode: "values" });

  for await (const chunk of stream) {
    finalState = chunk as GraphState;
    // Fire callback for new trace steps only
    if (onStep && finalState.traceSteps.length > 0) {
      const latest = finalState.traceSteps[finalState.traceSteps.length - 1];
      if (!seenSteps.has(latest)) {
        seenSteps.add(latest);
        onStep(latest);
      }
    }
  }

  if (!finalState) throw new Error("Graph produced no output");
  return finalState;
}