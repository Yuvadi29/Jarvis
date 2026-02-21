import { END, StateGraph } from "@langchain/langgraph";
import { AgentState, GraphState } from "./state";
import { orchestratorNode } from "../agents/orchestrator";
import { notesAgentNode } from "../agents/notes-agent";
import { searchAgentNode } from "../agents/search-agent";
import { synthesizerNode } from "../agents/synthesizer";
import { mediaAgentNode } from "../agents/media-agent";


// Routing Logic
// After orchestrator decides, send to first agent in queue
function routeFromOrchestrator(state: GraphState): string {
    const first = state.agentQueue[0];
    if (!first) return "synthesizer";
    return first;
}

// After notes agent, check if search should follow
function routeAfterNotes(state: GraphState): string {
    const queue = state.agentQueue;
    const searchIdx = queue.indexOf("search-agent");
    if (searchIdx !== -1) return "search-agent";
    const mediaIdx = queue.indexOf("media-agent");
    if (mediaIdx !== -1) return "media-agent";
    return "synthesizer";
}

// After search agent, check if media should follow
function routeAfterSearch(state: GraphState): string {
    const queue = state.agentQueue;
    const mediaIdx = queue.indexOf("media-agent");
    if (mediaIdx !== -1) return "media-agent";
    return "synthesizer";
}

// Build and compile the graph
export function buildGraph() {
    const graph = new StateGraph(AgentState)
        // Add all nodes
        .addNode("orchestrator", orchestratorNode)
        .addNode("notes-agent", notesAgentNode)
        .addNode("search-agent", searchAgentNode)
        .addNode("media-agent", mediaAgentNode)
        .addNode("synthesizer", synthesizerNode)

        // Entry point
        .addEdge("__start__", "orchestrator")

        // Orchestrator routes to first agent
        .addConditionalEdges(
            "orchestrator",
            routeFromOrchestrator,
            {
                "notes-agent": "notes-agent",
                "search-agent": "search-agent",
                "media-agent": "media-agent",
                synthesizer: "synthesizer",
            }
        )

        // After notes -> maybe search or synthesizer
        .addConditionalEdges(
            "notes-agent",
            routeAfterNotes,
            {
                "search-agent": "search-agent",
                "media-agent": "media-agent",
                synthesizer: "synthesizer",
            }
        )

        // After search -> maybe media or synthesizer
        .addConditionalEdges(
            "search-agent",
            routeAfterSearch,
            {
                "media-agent": "media-agent",
                synthesizer: "synthesizer",
            }
        )

        // Media always goes straight to synthesizer
        .addEdge("media-agent", "synthesizer")

        // Synthesizer is terminal
        .addEdge("synthesizer", END);

    return graph.compile();
}

export type CompiledGraph = ReturnType<typeof buildGraph>;