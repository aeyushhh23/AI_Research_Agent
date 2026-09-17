import type { ResearchSource } from "@ai-research-agent/shared";
import type { SearchProvider } from "./SearchProvider.js";

export class TavilyProvider implements SearchProvider {
  constructor(private readonly apiKey: string) {}

  async searchWeb(query: string, maxResults: number) {
    return this.search(query, maxResults, "general");
  }

  async searchNews(query: string, maxResults: number) {
    return this.search(query, maxResults, "news");
  }

  private async search(query: string, maxResults: number, topic: "general" | "news"): Promise<ResearchSource[]> {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        topic,
        max_results: Math.min(maxResults, 10),
        include_answer: false,
        include_raw_content: false
      })
    });
    if (!response.ok) throw new Error(`Tavily search failed: ${response.status} ${await response.text()}`);
    const data = (await response.json()) as { results?: Array<{ title: string; url: string; content?: string }> };
    return (data.results ?? []).map((item) => ({
      title: item.title,
      url: item.url,
      sourceType: topic === "news" ? "news" : "web",
      retrievedAt: new Date().toISOString(),
      summary: item.content
    }));
  }
}
