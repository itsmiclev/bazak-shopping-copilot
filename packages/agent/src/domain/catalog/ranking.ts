import { CATALOG_CURRENCY, type Product } from "@bazak/shared";
import type { SearchArgs } from "./types.js";
import {
  isCatalogCandidate,
  matchesPrice,
  matchesBrand,
  matchesAttributes,
} from "./filters.js";
export function filterAndRank(
  candidates: unknown[],
  args: SearchArgs,
): Product[] {
  const terms = (args.query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const excluded = new Set(args.excludeIds ?? []);
  const products = candidates
    .filter(isCatalogCandidate)
    .filter((p) => !excluded.has(p.id))
    .filter((p) => !args.category || p.category === args.category)
    .filter((p) => matchesPrice(p, args.minPrice, args.maxPrice))
    .filter((p) => matchesBrand(p, args.brand))
    .filter((p) => matchesAttributes(p, args.attributes))
    .map((p): Product => {
      const haystack =
        `${p.title} ${p.description} ${p.category} ${p.brand ?? ""}`.toLowerCase();
      const score = terms.length
        ? terms.filter((t) => haystack.includes(t)).length / terms.length
        : 1;
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        currency: CATALOG_CURRENCY,
        thumbnail: p.thumbnail,
        category: p.category,
        rating: Number.isFinite(p.rating) ? p.rating : undefined,
        score,
        confidence: score,
      };
    })
    .filter((p) => !terms.length || p.score === 1)
    .sort((a, b) =>
      args.sort === "price-asc"
        ? a.price - b.price
        : args.sort === "price-desc"
          ? b.price - a.price
          : (b.score ?? 0) - (a.score ?? 0),
    );
  return products;
}
