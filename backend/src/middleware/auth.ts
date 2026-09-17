import type { NextFunction, Request, Response } from "express";
import { verifyJwt, type JwtUser } from "../auth/jwt.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const queryToken = typeof req.query.token === "string" ? req.query.token : undefined;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : queryToken;
  if (!token) return res.status(401).json({ error: "Authentication required." });
  try {
    req.user = verifyJwt(token);
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}
