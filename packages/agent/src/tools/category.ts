import { tool } from "ai";
import { z } from "zod";
import {
  brandAndPriceFields,
  categoryField,
  paginationFields,
  attributeFields,
} from "./schemas.js";
import type { ToolContext } from "./context.js";
export function categoryTool({ session, callbacks }: ToolContext) {
  return tool({
    description:
      "Browse one catalog category, intersecting every known attribute, exact brand, price and currency constraint. Returns candidates and cursor, never cards. Use generic attribute search to inspect several relevant categories.",
    inputSchema: z.object({
      category: categoryField,
      ...attributeFields,
      ...brandAndPriceFields,
      ...paginationFields,
    }),
    execute: async (args) => {
      await callbacks.onToolCall?.("browseCategory", args);
      return session.retrieve({ ...args, limit: args.limit ?? 4 });
    },
  });
}
