import { config } from "./env.js";
import { query } from "../db/pool.js";

export type RuntimeStatus = {
  database: { ok: boolean; error?: string };
  llm: { provider: string; model: string; configured: boolean; missing: string[] };
  embeddings: { provider: string; model: string; configured: boolean; missing: string[] };
  search: { provider: string; configured: boolean; missing: string[] };
  github: { configured: boolean; optional: true };
};

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const database = await checkDatabase();
  const searchMissing =
    config.SEARCH_PROVIDER === "tavily"
      ? missingAny(["TAVILY_API_KEY", "SEARCH_API_KEY"], [config.TAVILY_API_KEY, config.SEARCH_API_KEY])
      : missingAny(["BRAVE_SEARCH_API_KEY", "SEARCH_API_KEY"], [config.BRAVE_SEARCH_API_KEY, config.SEARCH_API_KEY]);

  return {
    database,
    llm: {
      provider: config.LLM_PROVIDER,
      model: config.LLM_MODEL,
      configured: Boolean(config.GEMINI_API_KEY),
      missing: config.GEMINI_API_KEY ? [] : ["GEMINI_API_KEY"]
    },
    embeddings: {
      provider: config.EMBEDDING_PROVIDER,
      model: config.EMBEDDING_MODEL,
      configured: Boolean(config.GEMINI_API_KEY),
      missing: config.GEMINI_API_KEY ? [] : ["GEMINI_API_KEY"]
    },
    search: {
      provider: config.SEARCH_PROVIDER,
      configured: searchMissing.length === 0,
      missing: searchMissing
    },
    github: {
      configured: Boolean(config.GITHUB_TOKEN),
      optional: true
    }
  };
}

export async function assertResearchPreflight() {
  const status = await getRuntimeStatus();
  const missing = [
    ...(status.database.ok ? [] : ["DATABASE_URL"]),
    ...status.llm.missing,
    ...status.embeddings.missing,
    ...status.search.missing
  ];
  if (missing.length > 0) {
    const unique = [...new Set(missing)];
    throw Object.assign(new Error(`Research providers are not fully configured: ${unique.join(", ")}.`), {
      statusCode: 503,
      details: status
    });
  }
}

async function checkDatabase() {
  try {
    await query("SELECT 1");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Database unavailable." };
  }
}

function missingAny(names: string[], values: Array<string | undefined>) {
  return values.some(Boolean) ? [] : names;
}
