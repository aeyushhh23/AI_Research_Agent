import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const result = await query("SELECT id, title, created_at, updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC", [
      req.user!.id
    ]);
    res.json({ conversations: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = z.object({ title: z.string().min(1).max(160).default("New Research") }).parse(req.body);
    const result = await query(
      "INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at",
      [req.user!.id, body.title]
    );
    res.status(201).json({ conversation: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
