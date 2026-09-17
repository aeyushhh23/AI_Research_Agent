import { BraveProvider } from "./BraveProvider.js";
import type { SearchProvider } from "./SearchProvider.js";
import { TavilyProvider } from "./TavilyProvider.js";

export function createSearchProvider(): SearchProvider {
  const provider = process.env.SEARCH_PROVIDER ?? "tavily";
  if (provider === "tavily") {
    const key = process.env.TAVILY_API_KEY ?? process.env.SEARCH_API_KEY;
    if (!key) throw new Error("TAVILY_API_KEY or SEARCH_API_KEY is required when SEARCH_PROVIDER=tavily.");
    return new TavilyProvider(key);
  }
  if (provider === "brave") {
    const key = process.env.BRAVE_SEARCH_API_KEY ?? process.env.SEARCH_API_KEY;
    if (!key) throw new Error("BRAVE_SEARCH_API_KEY or SEARCH_API_KEY is required when SEARCH_PROVIDER=brave.");
    return new BraveProvider(key);
  }
  throw new Error(`Unsupported SEARCH_PROVIDER: ${provider}`);
}
