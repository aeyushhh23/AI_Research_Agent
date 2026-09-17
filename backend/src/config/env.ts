import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config();
dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(24, "JWT_SECRET must be at least 24 characters"),
  LLM_PROVIDER: z.enum(["gemini"]).default("gemini"),
  LLM_MODEL: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
  EMBEDDING_PROVIDER: z.enum(["gemini"]).default("gemini"),
  EMBEDDING_MODEL: z.string().default("text-embedding-004"),
  SEARCH_PROVIDER: z.enum(["tavily", "brave"]).default("tavily"),
  SEARCH_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  BRAVE_SEARCH_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  MAX_TOOL_CALLS: z.coerce.number().int().positive().default(15),
  MAX_RESEARCH_TIME: z.coerce.number().int().positive().default(120),
  MAX_SOURCE_BYTES: z.coerce.number().int().positive().default(120000),
  MCP_RESEARCH_COMMAND: z.string().default("node"),
  MCP_RESEARCH_ARGS: z.string().default("../mcp-servers/dist/research/server.js"),
  MCP_GITHUB_COMMAND: z.string().default("node"),
  MCP_GITHUB_ARGS: z.string().default("../mcp-servers/dist/github/server.js"),
  MCP_MEMORY_COMMAND: z.string().default("node"),
  MCP_MEMORY_ARGS: z.string().default("../mcp-servers/dist/memory/server.js")
});

export const config = schema.parse(process.env);

export function requireGeminiKey(): string {
  if (!config.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required for the configured Gemini LLM provider.");
  }
  return config.GEMINI_API_KEY;
}
