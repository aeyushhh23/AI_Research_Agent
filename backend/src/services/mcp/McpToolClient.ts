import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export type McpServerName = "research" | "github" | "memory";

type ServerConfig = {
  name: McpServerName;
  command: string;
  args: string[];
};

export class McpToolClient {
  private clients = new Map<McpServerName, Client>();

  constructor(private readonly servers: ServerConfig[]) {}

  async callTool<T>(serverName: McpServerName, toolName: string, args: Record<string, unknown>): Promise<T> {
    const client = await this.getClient(serverName);
    const result = await client.callTool({ name: toolName, arguments: args });
    const content = (result as { content?: Array<{ text?: string }> }).content ?? [];
    const text = content
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .join("")
      .trim();
    if (!text) throw new Error(`MCP tool ${serverName}.${toolName} returned no text content.`);
    return JSON.parse(text) as T;
  }

  async listTools(serverName: McpServerName) {
    const client = await this.getClient(serverName);
    return client.listTools();
  }

  async close() {
    for (const client of this.clients.values()) await client.close();
    this.clients.clear();
  }

  private async getClient(serverName: McpServerName) {
    const existing = this.clients.get(serverName);
    if (existing) return existing;
    const server = this.servers.find((s) => s.name === serverName);
    if (!server) throw new Error(`MCP server is not configured: ${serverName}`);
    const transport = new StdioClientTransport({ command: server.command, args: server.args });
    const client = new Client({ name: "ai-research-agent", version: "0.1.0" }, { capabilities: {} });
    await client.connect(transport);
    this.clients.set(serverName, client);
    return client;
  }
}
