import "dotenv/config";
import { buildGraph } from "./graph";
import type { GraphState } from "./state";

let _graph: ReturnType<typeof buildGraph> | null = null;

export function getGraph() {
    if (!_graph) {
        _graph = buildGraph();
    }
    return _graph;
}

// Run a query through a full agent graph
export async function runQuery(
    query: string,
    onStep?: (step: string) => void
): Promise<GraphState> {
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
    };

    // Stream events so we can show live trace steps in the UI
    let finalState: GraphState | null = null;

    const stream = await graph.stream(initialState, {
        streamMode: "values",
    });

    for await (const chunk of stream) {
        finalState = chunk as unknown as GraphState;
        // Fire callback for any new trace steps
        if (onStep && finalState.traceSteps.length > 0) {
            const latest = finalState.traceSteps[finalState.traceSteps.length - 1];
            onStep(latest);
        }
    }

    if (!finalState) {
        throw new Error("Graph produced no output");
    }

    return finalState;

}