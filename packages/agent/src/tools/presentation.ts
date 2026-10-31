import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./context.js";
export function presentationTool({
  session,
  selection,
  callbacks,
}: ToolContext) {
  return tool({
    description:
      "Render1–6 relevant IDs from this turn’s retrieved candidates once, after selection. Never call while clarifying preferences.",
    inputSchema: z.object({
      productIds: z.array(z.number().int()).min(1).max(6),
    }),
    execute: async ({ productIds }) => {
      await callbacks.onToolCall?.("presentProducts", { productIds });
      try {
        const products = selection.select(productIds);
        await callbacks.onProducts(products);
        session.markPresented(products);
        return {
          presentedIds: products.map((p) => p.id),
          instruction:
            "Cards show the details. Write one short paragraph without a product list or prices.",
        };
      } catch (error) {
        return {
          error:
            error instanceof Error
              ? error.message
              : "Could not present products",
        };
      }
    },
  });
}
