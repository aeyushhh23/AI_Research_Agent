import { GoogleGenerativeAI } from "@google/generative-ai";
import { config, requireGeminiKey } from "../../config/env.js";
import type { ChatMessage, LLMProvider } from "./LLMProvider.js";

export class GeminiProvider implements LLMProvider {
  private readonly client = new GoogleGenerativeAI(requireGeminiKey());

  async generateText(messages: ChatMessage[], options: { temperature?: number } = {}) {
    const model = this.client.getGenerativeModel({
      model: config.LLM_MODEL,
      generationConfig: { temperature: options.temperature ?? 0.2 }
    });
    const prompt = messages.map((m) => `${m.role.toUpperCase()}:\n${m.content}`).join("\n\n");
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  async generateJson<T>(messages: ChatMessage[], options: { temperature?: number } = {}) {
    const text = await this.generateText(
      [
        ...messages,
        {
          role: "system",
          content:
            "Return only valid JSON. Do not wrap it in Markdown fences. Do not include commentary outside JSON."
        }
      ],
      options
    );
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned) as T;
  }

  async embed(text: string) {
    const model = this.client.getGenerativeModel({ model: config.EMBEDDING_MODEL });
    const result = await model.embedContent(text.slice(0, 8000));
    return result.embedding.values;
  }
}
