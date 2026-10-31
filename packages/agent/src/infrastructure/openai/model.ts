import { createOpenAI } from "@ai-sdk/openai";
export const MODEL = "gpt-6-luna";
export function model() {
  return createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).responses(MODEL);
}
