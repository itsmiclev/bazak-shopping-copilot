import { tool } from "ai";
import { z } from "zod";
import { AttributeFilterSchema } from "@bazak/shared";
import { searchAcrossCategories } from "../application/category-search.js";
import { brandAndPriceFields, categoriesField } from "./schemas.js";
import type { ToolContext } from "./context.js";
export function attributesTool({ session, callbacks }: ToolContext) {
  return tool({
    description:
      "Search caller-selected catalog categories for explicit attribute evidence (such as style, material, scent or features). terms are REQUIRED positive evidence (aliases use any; combined requirements use all). excludeTerms are negative evidence. For a negative-only preference such as not makeup, omit terms and supply only excludeTerms; never require and exclude the same concept. Match every attribute constraint against product title, description and tags; no category-specific vocabulary is built in. Preserve brand, budget and currency. Do not invent attributes from absent evidence. Returns per-category searchIndex and scoped coverage, never cards.",
    inputSchema: z.object({
      categories: categoriesField,
      attributes: z.array(AttributeFilterSchema).min(1).max(6),
      ...brandAndPriceFields,
    }),
    execute: async (args) => {
      await callbacks.onToolCall?.("searchByAttributes", args);
      return searchAcrossCategories(args, session.retrieve);
    },
  });
}
