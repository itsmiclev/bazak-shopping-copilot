import { tool } from "ai";
import { z } from "zod";
import {
  brandAndPriceFields,
  paginationFields,
  attributeFields,
  categoryField,
} from "./schemas.js";
import type { ToolContext } from "./context.js";
export function keywordTool({ session, callbacks }: ToolContext) {
  return tool({
    description:
      "Literal keyword lookup. If category is supplied, inspect that category and apply the keyword locally. Preserve known attributes, brand, budget and currency. Literal search can miss synonyms; use searchByAttributes with explicit aliases for broader evidence matching. Does not render cards.",
    inputSchema: z.object({
      query: z.string().min(1).max(100),
      category: categoryField.optional(),
      ...attributeFields,
      ...brandAndPriceFields,
      ...paginationFields,
    }),
    execute: async (args) => {
      await callbacks.onToolCall?.("searchProducts", args);
      return session.retrieve({ ...args, limit: args.limit ?? 4 });
    },
  });
}
