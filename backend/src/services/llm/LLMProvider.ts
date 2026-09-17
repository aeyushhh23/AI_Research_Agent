export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface LLMProvider {
  generateText(messages: ChatMessage[], options?: { temperature?: number }): Promise<string>;
  generateJson<T>(messages: ChatMessage[], options?: { temperature?: number }): Promise<T>;
  embed(text: string): Promise<number[]>;
}
