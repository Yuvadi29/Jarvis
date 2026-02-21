import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { SearchResult } from "../graph/state.js";

// ─── Tavily Search Tool ───────────────────────────────────────────────────────
// Uses Tavily's API which is purpose-built for LLM agents (better than raw Google)
// Sign up free at https://app.tavily.com

export const tavilySearchTool = tool(
  async ({ query, max_results = 5 }): Promise<string> => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return JSON.stringify({ error: "TAVILY_API_KEY not set in .env" });
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results,
        search_depth: "basic",
        include_answer: true,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      return JSON.stringify({ error: `Tavily error: ${response.statusText}` });
    }

    const data = (await response.json()) as {
      answer?: string;
      results?: { title: string; url: string; content: string }[];
    };

    const results: SearchResult[] = (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 300),
    }));

    return JSON.stringify({
      answer: data.answer,
      results,
    });
  },
  {
    name: "web_search",
    description:
      "Search the web for current information. Returns a direct answer plus source links.",
    schema: z.object({
      query: z.string().describe("The search query"),
      max_results: z
        .number()
        .optional()
        .describe("Number of results to return (default 5)"),
    }),
  }
);