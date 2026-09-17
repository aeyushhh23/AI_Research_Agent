import { config } from "../../config/env.js";
import { McpToolClient } from "./McpToolClient.js";

const splitArgs = (value: string) => value.split(" ").map((v) => v.trim()).filter(Boolean);

export function createMcpToolClient() {
  return new McpToolClient([
    { name: "research", command: config.MCP_RESEARCH_COMMAND, args: splitArgs(config.MCP_RESEARCH_ARGS) },
    { name: "github", command: config.MCP_GITHUB_COMMAND, args: splitArgs(config.MCP_GITHUB_ARGS) },
    { name: "memory", command: config.MCP_MEMORY_COMMAND, args: splitArgs(config.MCP_MEMORY_ARGS) }
  ]);
}
