// This is the heart of LangGraph. The orchestrator looks at the query, decides which agents to invoke, and routes accordingly

import { END, StateGraph } from "@langchain/langgraph";
import { AgentName, AgentState, GraphState, Intent } from "../graph/state";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

// Schema the orchestrattor must return
const RoutingSchema = z.object({
    intent: z.enum([
        "notes",
        "search",
        "media",
        "hybrid"
    ]),
    agents: z.array(z.enum([
        "notes-agent",
        "search-agent",
        "media-agent"
    ])).min(1),
    reasoning: z.string(),
});

// Orchestrator Node
export async function orchestratorNode(state: GraphState): Promise<Partial<GraphState>> {
    const llm = new ChatOpenAI({
        model: 'gpt-4o-mini',
        temperature: 0,
    }).withStructuredOutput(RoutingSchema);

    const result = await llm.invoke([
        {
            role: "system",
            content: `You are an intelligent query router for a personal second-brain assistant.

You have 3 agents available:
- "notes-agent": searches the user's Obsidian vault (personal notes, ideas, projects)
- "search-agent": does a live web search for current information
- "media-agent": finds YouTube videos or images

Routing rules:
- If the query is about something the user likely has personal notes on → notes-agent
- If the query needs current/factual/news information → search-agent
- If the user explicitly asks for a video or image → media-agent
- If the query could benefit from both notes AND web search → hybrid (include both)
- For hybrid, put notes-agent first, then search-agent

Always return at least 1 agent. Return agents in the order they should execute.`,
        },
        {
            role: "user",
            content: state.query,
        },
    ]);

    const step = `🧭 Orchestrator → [${result.agents.join(", ")}] — ${result.reasoning}`;

    return {
        intent: result.intent as Intent,
        agentQueue: result.agents as AgentName[],
        activeAgent: "orchestrator",
        traceSteps: [step],
    };
}