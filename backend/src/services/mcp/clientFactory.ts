import { config } from "../../config/env.js";
import { McpToolClient } from "./McpToolClient.js";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

const splitArgs = (value: string) =>
  value
    .split(" ")
    .map((v) => v.trim())
    .filter(Boolean)
    .map(resolveMcpArg);

export function createMcpToolClient() {
  return new McpToolClient([
    { name: "research", command: config.MCP_RESEARCH_COMMAND, args: splitArgs(config.MCP_RESEARCH_ARGS) },
    { name: "github", command: config.MCP_GITHUB_COMMAND, args: splitArgs(config.MCP_GITHUB_ARGS) },
    { name: "memory", command: config.MCP_MEMORY_COMMAND, args: splitArgs(config.MCP_MEMORY_ARGS) }
  ]);
}

function resolveMcpArg(arg: string) {
  if (!arg.includes("mcp-servers")) return arg;
  const normalized = arg.replace(/\\/g, "/").replace(/^\.\.\//, "");
  const relativeFromRoot = normalized.slice(normalized.indexOf("mcp-servers"));
  return resolve(repoRoot, relativeFromRoot);
}

function findRepoRoot(start: string) {
  let current = start;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(resolve(current, "package.json")) && existsSync(resolve(current, "mcp-servers"))) return current;
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}
