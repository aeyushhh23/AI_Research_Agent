import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import pg from "pg";
import { z } from "zod";
import { jsonText, requireEnv, runServer } from "../utils.js";
import { embed, toVectorLiteral } from "./embed.js";

const pool = new pg.Pool({ connectionString: requireEnv("DATABASE_URL") });
const server = new McpServer({ name: "memory-mcp", version: "0.1.0" });

server.tool(
  "saveMemory",
  {
    userId: z.string().uuid(),
    content: z.string().min(1).max(4000),
    kind: z.string().min(1).max(80).default("preference"),
    metadata: z.record(z.unknown()).default({})
  },
  async ({ userId, content, kind, metadata }) => {
    const vector = toVectorLiteral(await embed(content));
    const result = await pool.query(
      "INSERT INTO memories (user_id, content, kind, embedding, metadata) VALUES ($1, $2, $3, $4::vector, $5) RETURNING id, content, kind, metadata, created_at",
      [userId, content, kind, vector, JSON.stringify(metadata)]
    );
    return jsonText({ memory: result.rows[0] });
  }
);

server.tool("searchMemory", { userId: z.string().uuid(), query: z.string().min(1), limit: z.number().int().min(1).max(20).default(5) }, async ({ userId, query, limit }) => {
  const vector = toVectorLiteral(await embed(query));
  const result = await pool.query(
    "SELECT id, content, kind, metadata, created_at, 1 - (embedding <=> $2::vector) AS score FROM memories WHERE user_id=$1 ORDER BY embedding <=> $2::vector LIMIT $3",
    [userId, vector, limit]
  );
  return jsonText({ results: result.rows });
});

server.tool("getResearchHistory", { userId: z.string().uuid(), limit: z.number().int().min(1).max(50).default(10) }, async ({ userId, limit }) => {
  const result = await pool.query(
    "SELECT id, question, status, report, created_at, completed_at FROM research_projects WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2",
    [userId, limit]
  );
  return jsonText({ research: result.rows });
});

server.tool("deleteMemory", { userId: z.string().uuid(), memoryId: z.string().uuid() }, async ({ userId, memoryId }) => {
  const result = await pool.query("DELETE FROM memories WHERE id=$1 AND user_id=$2 RETURNING id", [memoryId, userId]);
  return jsonText({ deleted: result.rowCount === 1 });
});

await runServer(server);
