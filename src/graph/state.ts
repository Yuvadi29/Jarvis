// Everything in LangGraph flows through a shared state
import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { MemoryContext } from "../lib/types";

// Intent types
export type Intent = "notes" | "search" | "media" | "hybrid" | null;
export type AgentName = "notes-agent" | "search-agent" | "media-agent";

// Result shapes
export interface NoteMatch {
    name: string;
    excerpt: string;
    path: string;
}

export interface SearchResult {
    title: string;
    url: string;
    channel: string;
}

export interface MediaResult {
    type: "video" | "image";
    title: string;
    url: string;
    thumbnail?: string;
    channel: string;
}

export interface BrowserResult {
    summary: string;
    actionsCount: number;
}

export interface AgentResults {
    notes?: NoteMatch[];
    search?: SearchResult[];
    media?: MediaResult[];
    browser?: BrowserResult;
}

// Shared LangGraph state
export const AgentState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),
    query: Annotation<string>({
        reducer: (_prev, next) => next,
        default: () => "",
    }),
    intent: Annotation<Intent>({
        reducer: (_prev, next) => next,
        default: () => null,
    }),
    agentQueue: Annotation<AgentName[]>({
        reducer: (_prev, next) => next,
        default: () => [],
    }),
    activeAgent: Annotation<string>({
        reducer: (_prev, next) => next,
        default: () => "idle",
    }),
    results: Annotation<AgentResults>({
        reducer: (prev, next) => ({ ...prev, ...next }),
        default: () => ({}),
    }),
    traceSteps: Annotation<string[]>({
        reducer: (prev, next) => [...prev, ...next],
        default: () => [],
    }),
    finalAnswer: Annotation<string>({
        reducer: (_prev, next) => next,
        default: () => "",
    }),

    // Memory
    memoryContext: Annotation<MemoryContext>({
        reducer: (_prev, next) => next,
        default: () => ({
            silentContext: "",
            explicitMemories: [],
            hasMemory: false,
        })
    })
});

export type GraphState = typeof AgentState.State;