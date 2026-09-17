import cors from "cors";
import express from "express";
import { config } from "./config/env.js";
import authRoutes from "./routes/auth.js";
import configRoutes from "./routes/config.js";
import conversationRoutes from "./routes/conversations.js";
import memoryRoutes from "./routes/memories.js";
import researchRoutes from "./routes/research.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export const app = express();

app.use(cors({ origin: config.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/config", configRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/research", researchRoutes);
app.use("/api/memories", memoryRoutes);
app.use(notFound);
app.use(errorHandler);
