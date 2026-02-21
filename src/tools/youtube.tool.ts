import { tool } from "@langchain/core/tools";
import z from "zod";

export const youtubeTool = tool(
    async ({ query }) => {
        const res = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=3&key=${process.env.YOUTUBE_API_KEY}`
        );
        const data = await res.json();
        return data.items.map((v: any) => ({
            title: v.snippet.title,
            url: `https://www.youtube.com/watch?v=${v.id.videoId}`,
            description: v.snippet.description,
            channel: v.snippet.channelTitle,
        }));
    },
    {
        name: "search_youtube",
        description: "Find YouTube videos",
        schema: z.object({
            query: z.string(),
        })
    }
)