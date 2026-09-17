const baseUrl = "https://api.github.com";

export type RepoRef = { owner: string; repo: string };

export function parseRepoUrl(url: string): RepoRef {
  const parsed = new URL(url);
  if (parsed.hostname !== "github.com") throw new Error("Only github.com repository URLs are supported.");
  const [owner, repo] = parsed.pathname.split("/").filter(Boolean);
  if (!owner || !repo) throw new Error("GitHub URL must include owner and repository.");
  return { owner, repo: repo.replace(/\.git$/, "") };
}

export async function githubRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "AIResearchAgent/0.1",
    ...(init.headers as Record<string, string> | undefined)
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(`GitHub API failed: ${response.status} ${await response.text()}`);
  return (await response.json()) as T;
}
