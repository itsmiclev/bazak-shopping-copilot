import type { Product } from "@bazak/shared";
/** Keeps retrieval evidence separate from the explicit decision to render cards. */
export function createProductSelection() {
  const candidates = new Map<number, Product>();
  let presented = false;
  return {
    add(products: Product[]) {
      for (const p of products) candidates.set(p.id, p);
    },
    select(ids: number[]) {
      if (presented)
        throw new Error(
          "Products were already presented this turn. Respond briefly now.",
        );
      if (
        !ids.length ||
        ids.length > 6 ||
        ids.some((id) => !candidates.has(id))
      )
        throw new Error(
          "Select1–6 IDs from this turn's retrieved candidates only.",
        );
      presented = true;
      return [...new Set(ids)].map((id) => candidates.get(id)!);
    },
  };
}
