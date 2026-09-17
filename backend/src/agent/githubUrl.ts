export type ParsedGitHubRepo = { owner: string; repo: string; url: string };

export function parseGitHubRepoUrl(input: string): ParsedGitHubRepo | null {
  const match = input.match(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?=[/?#\s]|$)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, ""), url: match[0].trim() };
}
