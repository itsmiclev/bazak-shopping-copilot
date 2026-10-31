import { tool } from "ai";
import { z } from "zod";
import {
  categoriesField,
  attributeFields,
  brandAndPriceFields,
} from "./schemas.js";
import { searchAcrossCategories } from "../application/category-search.js";
import type { ToolContext } from "./context.js";
export function priceTool({ session, callbacks }: ToolContext) {
  return tool({
    description:
      "Find products within a stated price range and one to three caller-selected categories. Preserve brand, attributes and currency. Currency defaults to catalog USD; other currencies return unsupported without conversion. Price sort is page-local, not a global cheapest guarantee.",
    inputSchema: z
      .object({
        categories: categoriesField,
        ...attributeFields,
        ...brandAndPriceFields,
      })
      .refine(
        (args) => args.minPrice !== undefined || args.maxPrice !== undefined,
        "Provide at least one price bound.",
      ),
    execute: async (args) => {
      await callbacks.onToolCall?.("searchByPrice", args);
      return searchAcrossCategories(args, session.retrieve);
    },
  });
}
