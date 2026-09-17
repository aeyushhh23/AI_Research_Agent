export type SourceType = "web" | "news" | "github" | "memory";

export type ResearchSource = {
  title: string;
  url: string;
  sourceType: SourceType;
  retrievedAt: string;
  summary?: string;
  content?: string;
};

export type ToolCallRecord = {
  id?: string;
  researchId?: string;
  server: "research" | "github" | "memory";
  toolName: string;
  arguments: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  success: boolean;
  error?: string;
};

export type ActivityEventName =
  | "research_started"
  | "planning_started"
  | "tool_started"
  | "tool_completed"
  | "source_found"
  | "memory_retrieved"
  | "analysis_started"
  | "report_generated"
  | "research_completed"
  | "research_failed";

export type ActivityEvent = {
  researchId: string;
  type: ActivityEventName;
  message: string;
  createdAt: string;
  payload?: Record<string, unknown>;
};

export type ResearchReport = {
  title: string;
  summary: string;
  keyFindings: string[];
  comparisonTable?: Array<Record<string, string>>;
  sources: ResearchSource[];
  limitations: string[];
};
