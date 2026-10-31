import { tool } from "ai";
import { z } from "zod";
import { categoriesField, attributeFields, priceFields } from "./schemas.js";
import { searchAcrossCategories } from "../application/category-search.js";
import type { ToolContext } from "./context.js";
export function brandTool({ session, callbacks }: ToolContext) {
  return tool({
    description:
      "Find an exact brand within one to three caller-selected categories. Retain all attribute evidence, price and currency constraints together. Never union results of independent filter searches. Returns per-category cursors and scoped coverage, never cards.",
    inputSchema: z.object({
      brand: z.string().min(1).max(100),
      categories: categoriesField,
      ...attributeFields,
      ...priceFields,
    }),
    execute: async (args) => {
      await callbacks.onToolCall?.("searchByBrand", args);
      return searchAcrossCategories(args, session.retrieve);
    },
  });
}
