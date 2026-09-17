import { Router } from "express";
import { z } from "zod";
import { signJwt } from "../auth/jwt.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { query } from "../db/pool.js";

const router = Router();
const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });

router.post("/register", async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const passwordHash = await hashPassword(body.password);
    const result = await query<{ id: string; email: string }>(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [body.email.toLowerCase(), passwordHash]
    );
    const user = result.rows[0];
    res.status(201).json({ token: signJwt(user), user });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const body = credentials.parse(req.body);
    const result = await query<{ id: string; email: string; password_hash: string }>(
      "SELECT id, email, password_hash FROM users WHERE email=$1",
      [body.email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    res.json({ token: signJwt({ id: user.id, email: user.email }), user: { id: user.id, email: user.email } });
  } catch (error) {
    next(error);
  }
});

export default router;
