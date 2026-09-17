import type { ResearchSource } from "@ai-research-agent/shared";
import type { SearchProvider } from "./SearchProvider.js";

export class BraveProvider implements SearchProvider {
  constructor(private readonly apiKey: string) {}

  async searchWeb(query: string, maxResults: number) {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(maxResults, 10)));
    const data = await this.request<{ web?: { results?: Array<{ title: string; url: string; description?: string }> } }>(url);
    return (data.web?.results ?? []).map((item) => this.toSource(item, "web"));
  }

  async searchNews(query: string, maxResults: number) {
    const url = new URL("https://api.search.brave.com/res/v1/news/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(Math.min(maxResults, 10)));
    const data = await this.request<{ results?: Array<{ title: string; url: string; description?: string }> }>(url);
    return (data.results ?? []).map((item) => this.toSource(item, "news"));
  }

  private async request<T>(url: URL): Promise<T> {
    const response = await fetch(url, { headers: { "X-Subscription-Token": this.apiKey, Accept: "application/json" } });
    if (!response.ok) throw new Error(`Brave Search failed: ${response.status} ${await response.text()}`);
    return (await response.json()) as T;
  }

  private toSource(item: { title: string; url: string; description?: string }, sourceType: "web" | "news"): ResearchSource {
    return { title: item.title, url: item.url, sourceType, retrievedAt: new Date().toISOString(), summary: item.description };
  }
}
