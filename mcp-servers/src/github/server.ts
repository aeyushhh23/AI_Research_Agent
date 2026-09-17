import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonText, runServer } from "../utils.js";
import { githubRequest, parseRepoUrl } from "./githubApi.js";

const server = new McpServer({ name: "github-mcp", version: "0.1.0" });

const repoInput = {
  owner: z.string().min(1).optional(),
  repo: z.string().min(1).optional(),
  url: z.string().url().optional()
};

function normalizeRepo(input: { owner?: string; repo?: string; url?: string }) {
  if (input.url) return parseRepoUrl(input.url);
  if (!input.owner || !input.repo) throw new Error("Provide either url or owner and repo.");
  return { owner: input.owner, repo: input.repo };
}

server.tool("getRepository", repoInput, async (input) => {
  const { owner, repo } = normalizeRepo(input);
  const data = await githubRequest<Record<string, unknown>>(`/repos/${owner}/${repo}`);
  return jsonText({
    source: {
      title: `${owner}/${repo}`,
      url: `https://github.com/${owner}/${repo}`,
      sourceType: "github",
      retrievedAt: new Date().toISOString(),
      summary: String(data.description ?? "")
    },
    repository: data
  });
});

server.tool("listFiles", { ...repoInput, ref: z.string().optional(), maxFiles: z.number().int().min(1).max(2000).default(500) }, async (input) => {
  const { owner, repo } = normalizeRepo(input);
  const repoData = await githubRequest<{ default_branch: string }>(`/repos/${owner}/${repo}`);
  const branch = input.ref ?? repoData.default_branch;
  const ref = await githubRequest<{ object: { sha: string } }>(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const tree = await githubRequest<{ tree: Array<{ path: string; type: string; size?: number }>; truncated: boolean }>(
    `/repos/${owner}/${repo}/git/trees/${ref.object.sha}?recursive=1`
  );
  return jsonText({
    repository: { owner, repo, ref: branch, truncated: tree.truncated },
    files: tree.tree.filter((item) => item.type === "blob").slice(0, input.maxFiles)
  });
});

server.tool("readFile", { ...repoInput, path: z.string().min(1), ref: z.string().optional() }, async (input) => {
  const { owner, repo } = normalizeRepo(input);
  const suffix = input.ref ? `?ref=${encodeURIComponent(input.ref)}` : "";
  const file = await githubRequest<{ name: string; path: string; html_url: string; content: string; encoding: string; size: number }>(
    `/repos/${owner}/${repo}/contents/${encodeURIComponent(input.path).replace(/%2F/g, "/")}${suffix}`
  );
  if (file.encoding !== "base64") throw new Error(`Unsupported GitHub file encoding: ${file.encoding}`);
  const content = Buffer.from(file.content, "base64").toString("utf8").slice(0, 60000);
  return jsonText({
    source: {
      title: file.path,
      url: file.html_url,
      sourceType: "github",
      retrievedAt: new Date().toISOString(),
      content
    },
    file: { path: file.path, size: file.size, content }
  });
});

server.tool("searchCode", { ...repoInput, query: z.string().min(1), maxResults: z.number().int().min(1).max(20).default(10) }, async (input) => {
  const { owner, repo } = normalizeRepo(input);
  const searchQuery = encodeURIComponent(`${input.query} repo:${owner}/${repo}`);
  const data = await githubRequest<{ items: Array<{ name: string; path: string; html_url: string; repository: { full_name: string } }> }>(
    `/search/code?q=${searchQuery}&per_page=${input.maxResults}`
  );
  return jsonText({
    results: data.items.map((item) => ({
      title: item.path,
      url: item.html_url,
      sourceType: "github",
      retrievedAt: new Date().toISOString(),
      summary: `Code search match in ${item.repository.full_name}`
    }))
  });
});

server.tool("getIssues", { ...repoInput, state: z.enum(["open", "closed", "all"]).default("open"), maxResults: z.number().int().min(1).max(30).default(10) }, async (input) => {
  const { owner, repo } = normalizeRepo(input);
  const data = await githubRequest<Array<{ title: string; html_url: string; body?: string; state: string; pull_request?: unknown }>>(
    `/repos/${owner}/${repo}/issues?state=${input.state}&per_page=${input.maxResults}`
  );
  return jsonText({
    results: data
      .filter((item) => !item.pull_request)
      .map((item) => ({
        title: item.title,
        url: item.html_url,
        sourceType: "github",
        retrievedAt: new Date().toISOString(),
        summary: item.body?.slice(0, 1000)
      }))
  });
});

await runServer(server);
