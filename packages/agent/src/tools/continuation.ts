import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./context.js";
export function continuationTool({ session, callbacks }: ToolContext) {
  return tool({
    description:
      "Continue a saved or current-turn searchIndex, preserving all category/attributes/brand/price/currency constraints and excluding shown cards. Use the index returned by retrieval, including each category result. Never reset pagination.",
    inputSchema: z.object({ searchIndex: z.number().int().nonnegative() }),
    execute: async ({ searchIndex }) => {
      await callbacks.onToolCall?.("continueSearch", { searchIndex });
      return session.continueSearch(searchIndex);
    },
  });
}
