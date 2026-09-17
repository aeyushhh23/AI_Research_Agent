import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "../../config/env.js";

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
    const result = await withTimeout(
      client.callTool({ name: toolName, arguments: args }),
      config.MCP_TOOL_TIMEOUT_MS,
      `MCP tool timed out: ${serverName}.${toolName}`
    );
    const content = (result as { content?: Array<{ text?: string }> }).content ?? [];
    const text = content
      .map((item) => (typeof item.text === "string" ? item.text : ""))
      .join("")
      .trim();
    if (!text) throw new Error(`MCP tool ${serverName}.${toolName} returned no text content.`);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`MCP tool ${serverName}.${toolName} returned non-JSON content: ${text.slice(0, 500)}`);
    }
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
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env: process.env as Record<string, string>
    });
    const client = new Client({ name: "ai-research-agent", version: "0.1.0" }, { capabilities: {} });
    await withTimeout(client.connect(transport), config.MCP_TOOL_TIMEOUT_MS, `MCP server connection timed out: ${serverName}`);
    this.clients.set(serverName, client);
    return client;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}
