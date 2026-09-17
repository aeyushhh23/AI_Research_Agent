import { describe, expect, it } from "vitest";
import { parseGitHubRepoUrl } from "../src/agent/githubUrl.js";

describe("parseGitHubRepoUrl", () => {
  it("parses arbitrary GitHub repository URLs", () => {
    expect(parseGitHubRepoUrl("Analyze https://github.com/openai/openai-node please")).toEqual({
      owner: "openai",
      repo: "openai-node",
      url: "https://github.com/openai/openai-node"
    });
  });

  it("returns null when no GitHub repository URL is present", () => {
    expect(parseGitHubRepoUrl("Research vector databases")).toBeNull();
  });
});
