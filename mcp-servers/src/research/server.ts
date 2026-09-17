import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText, runServer, validateHttpUrl } from "../utils.js";
import { createSearchProvider } from "./providerFactory.js";

const server = new McpServer({ name: "research-mcp", version: "0.1.0" });

server.tool("searchWeb", { query: z.string().min(1), maxResults: z.number().int().min(1).max(10).default(5) }, async ({ query, maxResults }) => {
  const provider = createSearchProvider();
  return jsonText({ results: await provider.searchWeb(query, maxResults) });
});

server.tool("searchNews", { query: z.string().min(1), maxResults: z.number().int().min(1).max(10).default(5) }, async ({ query, maxResults }) => {
  const provider = createSearchProvider();
  return jsonText({ results: await provider.searchNews(query, maxResults) });
});

server.tool("fetchWebPage", { url: z.string().url() }, async ({ url }) => {
  const parsed = validateHttpUrl(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(parsed, {
      headers: { "User-Agent": "AIResearchAgent/0.1 (+local developer research tool)" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    const html = (await response.text()).slice(0, Number(process.env.MAX_SOURCE_BYTES ?? 120000));
    const title = html.match(/<title[^>]*>(.*?)<\/title>/is)?.[1]?.replace(/\s+/g, " ").trim() ?? parsed.hostname;
    const content = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20000);
    return jsonText({
      source: { title, url: parsed.toString(), sourceType: "web", retrievedAt: new Date().toISOString(), content }
    });
  } finally {
    clearTimeout(timeout);
  }
});

await runServer(server);
