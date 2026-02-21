import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { MediaResult } from "../graph/state.js";

// ─── YouTube Search Tool ──────────────────────────────────────────────────────
export const youtubeSearchTool = tool(
  async ({ query, max_results = 3 }): Promise<string> => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error("YOUTUBE_API_KEY not set in .env");
    }

    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", String(max_results));
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());

    // Surface the actual API error body, not just statusText
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`YouTube API ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as {
      items?: {
        id: { videoId: string };
        snippet: {
          title: string;
          channelTitle: string;
          thumbnails: { default: { url: string } };
        };
      }[];
    };

    if (!data.items || data.items.length === 0) {
      return JSON.stringify({ results: [], message: "No videos found" });
    }

    const results: MediaResult[] = data.items.map((item) => ({
      type: "video" as const,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails.default.url,
      channel: item.snippet.channelTitle,
    }));

    return JSON.stringify({ results });
  },
  {
    name: "search_youtube",
    description:
      "Search YouTube for videos related to a topic. Returns video titles, URLs, and channel names.",
    schema: z.object({
      query: z.string().describe("The search query for YouTube"),
      max_results: z
        .number()
        .optional()
        .describe("Number of videos to return (default 3)"),
    }),
  }
);
