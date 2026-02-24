// Memory entry types stored in LanceDB
export type MemoryKind = "preference" | "habit" | "fact" | "conversation";

export interface MemoryImportance {
    shouldStore: boolean;
    kind: MemoryKind;
    importance: "low" | "medium" | "high";
    explicitRecall: boolean; // If true, Jarvis should mention it explicitly
}

// Raw row stored in LanceDB (vector + metadata)
export interface MemoryRow {
    id: string;
    kind: MemoryKind;
    content: string; //Human readable summary
    query?: string; // Original user query
    answer?: string; //Jarvis response (for conversations)
    importance: string;
    explicitRecall: boolean;
    createdAt: number;
    updatedAt: number;
    accessCount: number; // how many times retrieved
    vector: number[]; //embedding 
}

// What gets returned to graph
export interface RetrievedMemory {
    id: string;
    kind: MemoryKind;
    content: string;
    importance: string;
    explicitRecall: boolean;
    score: number; //Cosine similarity 0-1
    createdAt: number;
}

export interface MemoryContext {
    silentContext: string; //injected into system prompt quietly
    explicitMemories: RetrievedMemory[];
    hasMemory: boolean;
}