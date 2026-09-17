import type { ResearchSource, ToolCallRecord } from "@ai-research-agent/shared";
import type { McpServerName } from "../services/mcp/McpToolClient.js";

export type AgentToolName =
  | "searchWeb"
  | "fetchWebPage"
  | "searchNews"
  | "getRepository"
  | "listFiles"
  | "readFile"
  | "searchCode"
  | "getIssues"
  | "searchMemory"
  | "saveMemory";

export type PlannedToolCall = {
  server: McpServerName;
  toolName: AgentToolName;
  arguments: Record<string, unknown>;
  reason: string;
};

export type AgentState = {
  researchId: string;
  userId: string;
  question: string;
  plan: string[];
  toolCalls: ToolCallRecord[];
  nextTool?: PlannedToolCall | null;
  sources: ResearchSource[];
  observations: string[];
  relevantMemory: string[];
  finalReport?: unknown;
  toolCallCount: number;
  startedAt: number;
  error?: string;
};
