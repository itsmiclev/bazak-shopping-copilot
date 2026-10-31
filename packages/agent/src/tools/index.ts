import type { ToolContext } from "./context.js";
import { keywordTool } from "./keyword.js";
import { categoryTool } from "./category.js";
import { attributesTool } from "./attributes.js";
import { brandTool } from "./brand.js";
import { priceTool } from "./price.js";
import { continuationTool } from "./continuation.js";
import { presentationTool } from "./presentation.js";
export function createShoppingTools(context: ToolContext) {
  return {
    searchProducts: keywordTool(context),
    browseCategory: categoryTool(context),
    searchByAttributes: attributesTool(context),
    searchByBrand: brandTool(context),
    searchByPrice: priceTool(context),
    continueSearch: continuationTool(context),
    presentProducts: presentationTool(context),
  };
}
