import OpenAI from "openai";

let _client: OpenAI | null = null;
const getClient = () => {
    if (!_client) _client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!
    });
    return _client;
};

// Cache embeddings for identical strings within a session 
const cache = new Map<string, number[]>();

// Embed a single string 
export async function embed(text: string): Promise<number[]> {
    const key = text.trim();
    if (cache.has(key)) return cache.get(key)!;

    const response = await getClient().embeddings.create({
        model: "text-embedding-3-small",
        input: key,
    });

    const vector = response.data[0].embedding;
    cache.set(key, vector);
    return vector;
}

// ─── Embed multiple strings in one API call ──────────────────
export async function embedBatch(texts: string[]): Promise<number[][]> {
    const unique = [...new Set(texts.map((t) => t.trim()))];
    const uncached = unique.filter((t) => !cache.has(t));

    if (uncached.length > 0) {
        const response = await getClient().embeddings.create({
            model: "text-embedding-3-small",
            input: uncached,
        });
        response.data.forEach((item, i) => {
            cache.set(uncached[i], item.embedding);
        });
    }

    return texts.map((t) => cache.get(t.trim())!);
}