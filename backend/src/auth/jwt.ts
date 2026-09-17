import jwt from "jsonwebtoken";
import { config } from "../config/env.js";

export type JwtUser = { id: string; email: string };

export function signJwt(user: JwtUser): string {
  return jwt.sign(user, config.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): JwtUser {
  return jwt.verify(token, config.JWT_SECRET) as JwtUser;
}
