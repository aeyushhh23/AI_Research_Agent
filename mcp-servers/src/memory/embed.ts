import { GoogleGenerativeAI } from "@google/generative-ai";

export async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for memory embeddings.");
  const modelName = process.env.EMBEDDING_MODEL ?? "text-embedding-004";
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: modelName });
  const result = await model.embedContent(text.slice(0, 8000));
  return result.embedding.values;
}

export function toVectorLiteral(values: number[]) {
  return `[${values.map((v) => Number(v).toFixed(8)).join(",")}]`;
}
