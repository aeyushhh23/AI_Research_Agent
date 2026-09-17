import { config } from "../../config/env.js";
import { GeminiProvider } from "./GeminiProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

export function createLLMProvider(): LLMProvider {
  if (config.LLM_PROVIDER === "gemini") return new GeminiProvider();
  throw new Error(`Unsupported LLM provider: ${config.LLM_PROVIDER}`);
}
