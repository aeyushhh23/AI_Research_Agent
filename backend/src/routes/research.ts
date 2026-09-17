import { Router } from "express";
import { z } from "zod";
import { ResearchAgent } from "../agent/ResearchAgent.js";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { onActivity } from "../services/events.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, question, status, report, error, created_at, completed_at FROM research_projects WHERE user_id=$1 ORDER BY created_at DESC",
      [req.user!.id]
    );
    res.json({ research: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = z
      .object({
        question: z.string().min(3).max(4000),
        conversationId: z.string().uuid().optional()
      })
      .parse(req.body);

    const conversationId =
      body.conversationId ??
      (
        await query<{ id: string }>("INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id", [
          req.user!.id,
          body.question.slice(0, 120)
        ])
      ).rows[0].id;

    const created = await query<{ id: string }>(
      "INSERT INTO research_projects (user_id, conversation_id, question, status) VALUES ($1, $2, $3, 'running') RETURNING id",
      [req.user!.id, conversationId, body.question]
    );
    const researchId = created.rows[0].id;
    await query("INSERT INTO messages (conversation_id, role, content) VALUES ($1, 'user', $2)", [conversationId, body.question]);

    void new ResearchAgent().run(researchId, req.user!.id, body.question).catch(() => undefined);
    res.status(202).json({ researchId, conversationId, status: "running" });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, question, status, report, error, created_at, completed_at FROM research_projects WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user!.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Research not found." });
    res.json({ research: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/sources", async (req, res, next) => {
  try {
    await assertResearchOwner(req.params.id, req.user!.id);
    const result = await query("SELECT * FROM research_sources WHERE research_id=$1 ORDER BY retrieved_at", [req.params.id]);
    res.json({ sources: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/tool-calls", async (req, res, next) => {
  try {
    await assertResearchOwner(req.params.id, req.user!.id);
    const result = await query("SELECT * FROM tool_calls WHERE research_id=$1 ORDER BY started_at", [req.params.id]);
    res.json({ toolCalls: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/stream", async (req, res, next) => {
  try {
    await assertResearchOwner(req.params.id, req.user!.id);
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    const off = onActivity(req.params.id, (event) => {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });
    req.on("close", off);
  } catch (error) {
    next(error);
  }
});

async function assertResearchOwner(researchId: string, userId: string) {
  const result = await query("SELECT id FROM research_projects WHERE id=$1 AND user_id=$2", [researchId, userId]);
  if (!result.rowCount) throw new Error("Research not found or not authorized.");
}

export default router;
