import type { ResearchSource } from "@ai-research-agent/shared";

export interface SearchProvider {
  searchWeb(query: string, maxResults: number): Promise<ResearchSource[]>;
  searchNews(query: string, maxResults: number): Promise<ResearchSource[]>;
}
