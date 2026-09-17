import { z } from "zod";
import { query } from "../db/pool.js";
import { createLLMProvider } from "../services/llm/index.js";

const evaluationSchema = z.object({
  relevance: z.number().min(0).max(1),
  factualConsistency: z.number().min(0).max(1),
  sourceCoverage: z.number().min(0).max(1),
  toolSelection: z.number().min(0).max(1),
  memoryUsefulness: z.number().min(0).max(1),
  failureHandling: z.number().min(0).max(1),
  notes: z.array(z.string())
});

export async function evaluateResearch(researchId: string, userId: string) {
  const research = await query("SELECT * FROM research_projects WHERE id=$1 AND user_id=$2", [researchId, userId]);
  if (!research.rowCount) throw new Error("Research not found.");
  const sources = await query("SELECT title, url, source_type, summary FROM research_sources WHERE research_id=$1", [researchId]);
  const tools = await query("SELECT server, tool_name, success, error FROM tool_calls WHERE research_id=$1", [researchId]);
  const llm = createLLMProvider();
  const raw = await llm.generateJson<unknown>([
    {
      role: "system",
      content:
        "Evaluate the research run using only the provided report, tool calls, and source list. Return scores from 0 to 1 and concise notes. Do not invent evaluation results."
    },
    { role: "user", content: JSON.stringify({ research: research.rows[0], sources: sources.rows, toolCalls: tools.rows }) }
  ]);
  return evaluationSchema.parse(raw);
}
