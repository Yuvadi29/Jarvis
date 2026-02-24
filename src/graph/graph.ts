import { END, StateGraph } from "@langchain/langgraph";
import { AgentState, GraphState } from "./state";
import { orchestratorNode } from "../agents/orchestrator";
import { notesAgentNode } from "../agents/notes-agent";
import { searchAgentNode } from "../agents/search-agent";
import { synthesizerNode } from "../agents/synthesizer";
import { mediaAgentNode } from "../agents/media-agent";
import { memoryRetrieveNode, memoryStoreNode } from "../agents/memory-agent";


function nextInQueue(state: GraphState, afterAgent: string): string {
    const queue = state.agentQueue;
    const idx = queue.indexOf(afterAgent as any);
    const next = queue[idx + 1];
    return next ?? "synthesizer";
};

// Routing Logic
// After orchestrator decides, send to first agent in queue
function routeFromOrchestrator(state: GraphState): string {
    const first = state.agentQueue[0];
    if (!first) return "synthesizer";
    return first;
}

// Build and compile the graph
export function buildGraph() {
    const graph = new StateGraph(AgentState)

        // Memorynodes
        .addNode("memory-retrieve", memoryRetrieveNode)
        .addNode("memory-store", memoryStoreNode)

        // Core agents
        .addNode("orchestrator", orchestratorNode)
        .addNode("notes-agent", notesAgentNode)
        .addNode("search-agent", searchAgentNode)
        .addNode("media-agent", mediaAgentNode)
        .addNode("synthesizer", synthesizerNode)

        // Flow: memory-retrieve -> orchestrator -> ... -> memory-store
        .addEdge("__start__", "memory-retrieve")
        .addEdge("memory-retrieve", "orchestrator")

        // After notes -> maybe search or synthesizer
        .addConditionalEdges("orchestrator", routeFromOrchestrator, {
            "notes-agent": "notes-agent",
            "search-agent": "search-agent",
            "media-agent": "media-agent",
            "synthesizer": "synthesizer",
        })

        .addConditionalEdges("notes-agent",
            (s) => nextInQueue(s, "notes-agent"),
            {
                "search-agent": "search-agent", "media-agent": "media-agent",
                synthesizer: "synthesizer"
            })

        .addConditionalEdges("search-agent",
            (s) => nextInQueue(s, "search-agent"),
            {
                "notes-agent": "notes-agent", "media-agent": "media-agent",
                synthesizer: "synthesizer"
            })

        .addConditionalEdges("media-agent",
            (s) => nextInQueue(s, "media-agent"),
            {
                "notes-agent": "notes-agent", "search-agent": "search-agent",
                synthesizer: "synthesizer"
            })

        .addEdge("synthesizer", "memory-store")
        .addEdge("memory-store", END);

    return graph.compile();
}

export type CompiledGraph = ReturnType<typeof buildGraph>;