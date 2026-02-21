import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs";
import path from "path";
import type { NoteMatch } from "../graph/state.js";

// ─── Recursively walk a directory and collect .md files ───────────────────────
function walkVault(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir)) {
    // Skip hidden dirs (e.g. .obsidian)
    if (entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      walkVault(full, files);
    } else if (entry.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

// ─── Simple keyword scorer ────────────────────────────────────────────────────
function scoreNote(content: string, keywords: string[]): number {
  const lower = content.toLowerCase();
  return keywords.reduce((score, kw) => {
    const matches = (lower.match(new RegExp(kw.toLowerCase(), "g")) || []).length;
    return score + matches;
  }, 0);
}

// ─── Exported LangChain tool ──────────────────────────────────────────────────
export const obsidianTool = tool(
  async ({ query, max_results = 5 }): Promise<string> => {
    const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
    if (!vaultPath) {
      return JSON.stringify({ error: "OBSIDIAN_VAULT_PATH not set in .env" });
    }

    const keywords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const allFiles = walkVault(vaultPath);

    if (allFiles.length === 0) {
      return JSON.stringify({ error: "No markdown files found in vault" });
    }

    // Score and sort files by relevance
    const scored = allFiles
      .map((filePath) => {
        const content = fs.readFileSync(filePath, "utf-8");
        const score = scoreNote(content, keywords);
        return { filePath, content, score };
      })
      .filter((f) => f.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max_results);

    if (scored.length === 0) {
      return JSON.stringify({ matches: [], message: "No notes matched the query" });
    }

    const matches: NoteMatch[] = scored.map(({ filePath, content }) => ({
      name: path.basename(filePath, ".md"),
      path: filePath,
      excerpt: content.slice(0, 600).trim(),
    }));

    return JSON.stringify({ matches });
  },
  {
    name: "search_obsidian_notes",
    description:
      "Search the user's Obsidian vault for notes matching a query. Returns relevant note names and excerpts.",
    schema: z.object({
      query: z.string().describe("The search query to find relevant notes"),
      max_results: z
        .number()
        .optional()
        .describe("Maximum number of notes to return (default 5)"),
    }),
  }
);