import { recentSearches } from "./saved-searches.js";
import type { Message } from "@bazak/shared";
import type { ModelMessage } from "ai";
export function contextMessages(messages: Message[]): ModelMessage[] {
  let budget = 24_000;
  const selected: ModelMessage[] = [];
  for (const m of messages.slice(-30).reverse()) {
    const details = m.products?.length
      ? `\nCatalog results previously shown: ${JSON.stringify(m.products.map((p) => ({ id: p.id, title: p.title, price: p.price, category: p.category })))}`
      : "";
    const searches = m.searches?.length
      ? `\nHistorical retrieval cursors (indices start at0; not current preferences—use the latest conversation agreement): ${JSON.stringify(recentSearches(m.searches))}`
      : "";
    const content = m.text + details + searches;
    if (content.length > budget) break;
    budget -= content.length;
    selected.unshift({
      role: m.role,
      content: content || "(No text response was produced.)",
    });
  }
  while (selected[0]?.role === "assistant") selected.shift();
  return selected;
}
