import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { loadMcpTools } from "@langchain/mcp-adapters";

export async function getMCPTools() {
    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-obsidian"],
        env: { OBSIDIAN_VAULT_PATH: process.env.OBSIDIAN_VAULT_PATH! },
    });

    const client = new Client({ name: "jarvis", version: "1.0.0" });
    await client.connect(transport);

    // converts MCP tools → LangChain tools
    return loadMcpTools("obsidian", client);
}