import path from "path";
import os from "os";
import { v4 as uuid } from "uuid";
import { MemoryKind, MemoryRow, RetrievedMemory } from "./types";
import { embed } from "./embedder";
import * as lancedb from "@lancedb/lancedb";

// LanceDB is a dynamic import because it uses native bindings
const MEMORY_DIR = process.env.JARVIS_MEMORY_PATH
    ?? path.join(os.homedir(), ".jarvis", "memory");

const VECTOR_DIMS = 1536;
const TABLE_NAME = "memories";

// ─── Lazy singleton connection ────────────────────────────────────────────────
let _db: any = null;
let _table: any = null;

async function getTable() {
    if (_table) return _table;

    _db = await lancedb.connect(MEMORY_DIR);

    const tableNames = await _db.tableNames();

    if (tableNames.includes(TABLE_NAME)) {
        _table = await _db.openTable(TABLE_NAME);
    } else {
        // Bootstrap with a dummy row so LanceDB knows the schema
        const dummyVector = new Array(VECTOR_DIMS).fill(0);
        _table = await _db.createTable(TABLE_NAME, [
            {
                id: "bootstrap",
                kind: "fact" as MemoryKind,
                content: "__bootstrap__",
                query: "",
                answer: "",
                importance: "low",
                explicitRecall: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                accessCount: 0,
                vector: dummyVector,
            } satisfies MemoryRow,
        ]);

        // Remove the bootstrap row
        await _table.delete('id = "bootstrap"');
    }

    return _table;
}

// ─── Store a new memory ───────────────────────────────────────────────────────
export async function storeMemory(opts: {
    kind: MemoryKind;
    content: string;
    query?: string;
    answer?: string;
    importance: "low" | "medium" | "high";
    explicitRecall: boolean;
}): Promise<string> {
    const table = await getTable();
    const id = uuid();
    const vector = await embed(opts.content);
    const now = Date.now();

    const row: MemoryRow = {
        id,
        kind: opts.kind,
        content: opts.content,
        query: opts.query ?? "",
        answer: opts.answer ?? "",
        importance: opts.importance,
        explicitRecall: opts.explicitRecall,
        createdAt: now,
        updatedAt: now,
        accessCount: 0,
        vector,
    };

    await table.add([row]);
    console.log(`[memory] 💾 Stored ${opts.kind}: "${opts.content.slice(0, 60)}"`);
    return id;
}

// ─── Retrieve top-k similar memories ──────────────────────────────────────────
export async function retrieveMemories(
    query: string,
    opts: {
        limit?: number;
        minScore?: number;
        kinds?: MemoryKind[];
    } = {}
): Promise<RetrievedMemory[]> {
    const { limit = 8, minScore = 0.55, kinds } = opts;

    const table = await getTable();
    const queryVector = await embed(query);

    let search = table.search(queryVector).limit(limit * 2); // over-fetch then filter

    const rawResults = await search.toArray();

    let results = rawResults as Array<MemoryRow & { _distance: number }>;

    // Filter by kind if specified
    if (kinds?.length) {
        results = results.filter((r) => kinds.includes(r.kind));
    }

    // Convert L2 distance → cosine-like score (LanceDB returns L2 by default)
    // Score = 1 - (distance / 2) for normalized vectors
    const scored: RetrievedMemory[] = results
        .map((r) => ({
            id: r.id,
            kind: r.kind,
            content: r.content,
            importance: r.importance,
            explicitRecall: r.explicitRecall,
            score: Math.max(0, 1 - r._distance / 2),
            createdAt: r.createdAt,
        }))
        .filter((r) => r.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    // Bump access count for retrieved memories (async, don't await)
    scored.forEach((r) => {
        table
            .update({ where: `id = "${r.id}"`, values: { accessCount: 1 } })
            .catch(() => { });
    });

    return scored;
}

// ─── Delete a memory by id ────────────────────────────────────────────────────
export async function deleteMemory(id: string): Promise<void> {
    const table = await getTable();
    await table.delete(`id = "${id}"`);
}

// ─── List all memories (for "what do you remember?" queries) ─────────────────
export async function listMemories(kind?: MemoryKind): Promise<MemoryRow[]> {
    const table = await getTable();
    const all = await table.search(new Array(VECTOR_DIMS).fill(0)).limit(500).toArray();
    return kind ? all.filter((r: MemoryRow) => r.kind === kind) : all;
}