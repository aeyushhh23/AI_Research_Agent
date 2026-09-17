import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import type { ResearchReport, ResearchSource, ToolCallRecord } from "@ai-research-agent/shared";
import { config } from "../config/env.js";
import { query } from "../db/pool.js";
import { createLLMProvider } from "../services/llm/index.js";
import type { LLMProvider } from "../services/llm/LLMProvider.js";
import { createMcpToolClient } from "../services/mcp/clientFactory.js";
import type { McpToolClient } from "../services/mcp/McpToolClient.js";
import { emitActivity, makeEvent } from "../services/events.js";
import { parseGitHubRepoUrl } from "./githubUrl.js";
import type { AgentState, PlannedToolCall } from "./types.js";

const allowedTools = new Map<string, Set<string>>([
  ["research", new Set(["searchWeb", "fetchWebPage", "searchNews"])],
  ["github", new Set(["getRepository", "listFiles", "readFile", "searchCode", "getIssues"])],
  ["memory", new Set(["searchMemory", "saveMemory"])]
]);

const State = Annotation.Root({
  researchId: Annotation<string>(),
  userId: Annotation<string>(),
  question: Annotation<string>(),
  plan: Annotation<string[]>({ reducer: (_old, value) => value, default: () => [] }),
  toolCalls: Annotation<ToolCallRecord[]>({ reducer: (old, value) => old.concat(value), default: () => [] }),
  nextTool: Annotation<PlannedToolCall | null | undefined>({ reducer: (_old, value) => value, default: () => null }),
  sources: Annotation<ResearchSource[]>({ reducer: (old, value) => old.concat(value), default: () => [] }),
  observations: Annotation<string[]>({ reducer: (old, value) => old.concat(value), default: () => [] }),
  relevantMemory: Annotation<string[]>({ reducer: (old, value) => old.concat(value), default: () => [] }),
  finalReport: Annotation<unknown | undefined>(),
  toolCallCount: Annotation<number>({ reducer: (_old, value) => value, default: () => 0 }),
  startedAt: Annotation<number>(),
  error: Annotation<string | undefined>()
});

export class ResearchAgent {
  private readonly llm: LLMProvider = createLLMProvider();
  private readonly mcp: McpToolClient = createMcpToolClient();

  async run(researchId: string, userId: string, question: string) {
    await query(
      "INSERT INTO agent_runs (research_id, model, max_tool_calls, status) VALUES ($1, $2, $3, 'running')",
      [researchId, config.LLM_MODEL, config.MAX_TOOL_CALLS]
    );
    emitActivity(makeEvent(researchId, "research_started", "Research started."));

    const graph = new StateGraph(State)
      .addNode("retrieveMemory", this.retrieveMemory.bind(this))
      .addNode("plan", this.plan.bind(this))
      .addNode("selectTool", this.selectTool.bind(this))
      .addNode("executeTool", this.executeTool.bind(this))
      .addNode("evaluate", this.evaluate.bind(this))
      .addNode("analyze", this.analyze.bind(this))
      .addNode("extractMemory", this.extractMemory.bind(this))
      .addEdge(START, "retrieveMemory")
      .addEdge("retrieveMemory", "plan")
      .addEdge("plan", "selectTool")
      .addConditionalEdges("selectTool", (state) => (state.nextTool ? "executeTool" : "analyze"))
      .addEdge("executeTool", "evaluate")
      .addConditionalEdges("evaluate", (state) => {
        const timedOut = Date.now() - state.startedAt > config.MAX_RESEARCH_TIME * 1000;
        if (state.error || timedOut || state.toolCallCount >= config.MAX_TOOL_CALLS) return "analyze";
        return state.nextTool ? "executeTool" : "analyze";
      })
      .addEdge("analyze", "extractMemory")
      .addEdge("extractMemory", END)
      .compile();

    try {
      const result = await graph.invoke({
        researchId,
        userId,
        question,
        startedAt: Date.now(),
        toolCallCount: 0
      });
      await query(
        "UPDATE research_projects SET status='completed', report=$2, completed_at=now() WHERE id=$1",
        [researchId, JSON.stringify(result.finalReport)]
      );
      await query(
        "UPDATE agent_runs SET status='completed', completed_at=now() WHERE research_id=$1 AND status='running'",
        [researchId]
      );
      emitActivity(makeEvent(researchId, "research_completed", "Research completed."));
      return result.finalReport as ResearchReport;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed.";
      await query("UPDATE research_projects SET status='failed', error=$2, completed_at=now() WHERE id=$1", [
        researchId,
        message
      ]);
      await query("UPDATE agent_runs SET status='failed', error=$2, completed_at=now() WHERE research_id=$1", [
        researchId,
        message
      ]);
      emitActivity(makeEvent(researchId, "research_failed", message));
      throw error;
    } finally {
      await this.mcp.close();
    }
  }

  private async retrieveMemory(state: AgentState): Promise<Partial<AgentState>> {
    emitActivity(makeEvent(state.researchId, "memory_retrieved", "Retrieving relevant memory."));
    const memories = await this.safeToolCall<{ results: Array<{ content: string }> }>(state, {
      server: "memory",
      toolName: "searchMemory",
      arguments: { userId: state.userId, query: state.question, limit: 5 },
      reason: "Retrieve relevant long-term memory before planning."
    });
    return { relevantMemory: memories?.results?.map((m) => m.content) ?? [], toolCallCount: state.toolCallCount + 1 };
  }

  private async plan(state: AgentState): Promise<Partial<AgentState>> {
    emitActivity(makeEvent(state.researchId, "planning_started", "Planning research approach."));
    const repo = parseGitHubRepoUrl(state.question);
    const plan = await this.llm.generateJson<{ steps: string[] }>([
      {
        role: "system",
        content:
          "You plan research. Use real external tools when facts, sources, news, repositories, or memory are needed. Do not invent facts."
      },
      {
        role: "user",
        content: JSON.stringify({
          question: state.question,
          detectedGithubRepository: repo,
          relevantMemory: state.relevantMemory,
          availableTools: Object.fromEntries([...allowedTools.entries()].map(([k, v]) => [k, [...v]]))
        })
      }
    ]);
    return { plan: plan.steps?.slice(0, 8) ?? ["Research the request using available tools."] };
  }

  private async selectTool(state: AgentState): Promise<Partial<AgentState>> {
    const selected = await this.llm.generateJson<{ done: boolean; tool?: PlannedToolCall }>([
      {
        role: "system",
        content:
          "Select the next MCP tool call or mark done. Use only allowlisted tools. Prefer fetching/reading sources after search when needed. Return JSON with done and optional tool."
      },
      {
        role: "user",
        content: JSON.stringify({
          question: state.question,
          plan: state.plan,
          relevantMemory: state.relevantMemory,
          sourceCount: state.sources.length,
          observations: state.observations.slice(-8),
          previousToolCalls: state.toolCalls.map((t) => ({ server: t.server, toolName: t.toolName, success: t.success, error: t.error })),
          allowedTools: Object.fromEntries([...allowedTools.entries()].map(([k, v]) => [k, [...v]]))
        })
      }
    ]);
    if (selected.done || !selected.tool) return { nextTool: null };
    this.assertAllowedTool(selected.tool);
    return { nextTool: selected.tool };
  }

  private async executeTool(state: AgentState): Promise<Partial<AgentState>> {
    if (!state.nextTool) return { nextTool: null };
    if (state.toolCallCount >= config.MAX_TOOL_CALLS) return { nextTool: null };
    const result = await this.safeToolCall<unknown>(state, state.nextTool);
    const sources = this.extractSources(result);
    for (const source of sources) {
      await query(
        "INSERT INTO research_sources (research_id, title, url, source_type, summary, content) VALUES ($1, $2, $3, $4, $5, $6)",
        [state.researchId, source.title, source.url, source.sourceType, source.summary ?? null, source.content ?? null]
      );
      emitActivity(makeEvent(state.researchId, "source_found", `Source found: ${source.title}`, { url: source.url }));
    }
    return {
      observations: [JSON.stringify({ tool: state.nextTool.toolName, result }).slice(0, 8000)],
      sources,
      toolCallCount: state.toolCallCount + 1,
      nextTool: null
    };
  }

  private async evaluate(state: AgentState): Promise<Partial<AgentState>> {
    const decision = await this.llm.generateJson<{ sufficient: boolean; nextTool?: PlannedToolCall; reason: string }>([
      {
        role: "system",
        content:
          "Decide if there is enough evidence for a sourced report. If not, choose exactly one next allowlisted MCP tool. Never request arbitrary shell or unlisted tools."
      },
      {
        role: "user",
        content: JSON.stringify({
          question: state.question,
          sources: state.sources.map((s) => ({ title: s.title, url: s.url, type: s.sourceType })),
          observations: state.observations.slice(-10),
          toolCallsUsed: state.toolCallCount,
          maxToolCalls: config.MAX_TOOL_CALLS,
          allowedTools: Object.fromEntries([...allowedTools.entries()].map(([k, v]) => [k, [...v]]))
        })
      }
    ]);
    if (decision.sufficient || !decision.nextTool) return { nextTool: null };
    this.assertAllowedTool(decision.nextTool);
    return { nextTool: decision.nextTool };
  }

  private async analyze(state: AgentState): Promise<Partial<AgentState>> {
    emitActivity(makeEvent(state.researchId, "analysis_started", "Generating final report."));
    const report = await this.llm.generateJson<ResearchReport>([
      {
        role: "system",
        content:
          "Generate a factual research report from the provided observations and sources only. Include limitations for missing data. Cite only URLs present in sources."
      },
      {
        role: "user",
        content: JSON.stringify({
          question: state.question,
          memory: state.relevantMemory,
          sources: state.sources,
          observations: state.observations
        })
      }
    ]);
    emitActivity(makeEvent(state.researchId, "report_generated", "Report generated."));
    return { finalReport: report };
  }

  private async extractMemory(state: AgentState): Promise<Partial<AgentState>> {
    const extraction = await this.llm.generateJson<{ memories: Array<{ content: string; kind: string }> }>([
      {
        role: "system",
        content:
          "Extract only durable user preferences or reusable project context. Do not save ordinary one-off research questions or facts from external sources."
      },
      { role: "user", content: JSON.stringify({ question: state.question, report: state.finalReport }) }
    ]);
    for (const memory of extraction.memories ?? []) {
      await this.safeToolCall(state, {
        server: "memory",
        toolName: "saveMemory",
        arguments: { userId: state.userId, content: memory.content, kind: memory.kind, metadata: { researchId: state.researchId } },
        reason: "Persist durable memory extracted from this research run."
      });
    }
    return {};
  }

  private async safeToolCall<T>(state: AgentState, tool: PlannedToolCall): Promise<T | null> {
    this.assertAllowedTool(tool);
    const started = Date.now();
    emitActivity(makeEvent(state.researchId, "tool_started", `Running ${tool.server}.${tool.toolName}.`));
    try {
      const result = await this.mcp.callTool<T>(tool.server, tool.toolName, tool.arguments);
      const record: ToolCallRecord = {
        researchId: state.researchId,
        server: tool.server,
        toolName: tool.toolName,
        arguments: tool.arguments,
        durationMs: Date.now() - started,
        success: true
      };
      await this.recordToolCall(record);
      emitActivity(makeEvent(state.researchId, "tool_completed", `${tool.server}.${tool.toolName} completed.`));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool call failed.";
      const record: ToolCallRecord = {
        researchId: state.researchId,
        server: tool.server,
        toolName: tool.toolName,
        arguments: tool.arguments,
        durationMs: Date.now() - started,
        success: false,
        error: message
      };
      await this.recordToolCall(record);
      emitActivity(makeEvent(state.researchId, "tool_completed", `${tool.server}.${toolNameLabel(tool)} failed: ${message}`));
      return null;
    }
  }

  private async recordToolCall(record: ToolCallRecord) {
    await query(
      "INSERT INTO tool_calls (research_id, server, tool_name, arguments, duration_ms, success, error, completed_at) VALUES ($1, $2, $3, $4, $5, $6, $7, now())",
      [
        record.researchId,
        record.server,
        record.toolName,
        JSON.stringify(record.arguments),
        record.durationMs ?? null,
        record.success,
        record.error ?? null
      ]
    );
  }

  private extractSources(result: unknown): ResearchSource[] {
    if (!result || typeof result !== "object") return [];
    const candidate = result as { sources?: ResearchSource[]; results?: ResearchSource[]; source?: ResearchSource };
    if (Array.isArray(candidate.sources)) return candidate.sources;
    if (Array.isArray(candidate.results)) return candidate.results.filter((r) => r.url && r.title);
    if (candidate.source) return [candidate.source];
    return [];
  }

  private assertAllowedTool(tool: PlannedToolCall) {
    const allowed = allowedTools.get(tool.server);
    if (!allowed?.has(tool.toolName)) {
      throw new Error(`Tool is not allowlisted: ${tool.server}.${tool.toolName}`);
    }
  }
}

function toolNameLabel(tool: PlannedToolCall) {
  return `${tool.toolName}`;
}
