import { Router } from "express";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const result = await query(
      "SELECT id, content, kind, metadata, created_at FROM memories WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100",
      [req.user!.id]
    );
    res.json({ memories: result.rows });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const result = await query("DELETE FROM memories WHERE id=$1 AND user_id=$2 RETURNING id", [req.params.id, req.user!.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Memory not found." });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
