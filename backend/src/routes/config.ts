import { Router } from "express";
import { getRuntimeStatus } from "../config/runtimeStatus.js";

const router = Router();

router.get("/status", async (_req, res, next) => {
  try {
    res.json({ status: await getRuntimeStatus() });
  } catch (error) {
    next(error);
  }
});

export default router;
