import {
  CATALOG_CURRENCY,
  CurrencyCodeSchema,
  AttributeFilterSchema,
} from "@bazak/shared";
import { RetrievalError } from "./types.js";
import { categories } from "./categories.js";
import type { SearchArgs } from "./types.js";
export function normalizeSearch(
  args: SearchArgs,
): SearchArgs & { query: string; skip: number; limit: number } {
  const query = args.query?.trim() ?? "";
  const brand = args.brand?.trim();
  const skip = args.skip ?? 0;
  const limit = args.limit ?? 8;
  if (!query && !args.category && !brand)
    throw new Error("Provide a search term, category, or brand.");
  const parsedCurrency = CurrencyCodeSchema.safeParse(
    args.currency ?? CATALOG_CURRENCY,
  );
  if (!parsedCurrency.success)
    throw new RetrievalError(
      "Use a three-letter currency code.",
      0,
      0,
      false,
      "INVALID_CURRENCY",
    );
  const currency = parsedCurrency.data;
  if (currency !== CATALOG_CURRENCY)
    throw new RetrievalError(
      `Unsupported currency ${currency}. The catalog is priced in ${CATALOG_CURRENCY}; no exchange conversion is available. Ask for a ${CATALOG_CURRENCY} budget before searching.`,
      0,
      0,
      false,
      "UNSUPPORTED_CURRENCY",
    );
  if (args.style)
    throw new RetrievalError(
      "This saved search uses a legacy style filter. Start a new search with explicit attribute evidence terms; do not drop the saved constraint.",
      0,
      0,
      false,
      "LEGACY_SEARCH_REQUIRES_REFRESH",
    );
  if (args.attributes && args.attributes.length > 6)
    throw new Error("Use at most six attribute constraints.");
  const attributes = args.attributes?.map((attribute) =>
    AttributeFilterSchema.parse(attribute),
  );
  for (const attribute of attributes ?? []) {
    const normalize = (term: string) =>
      term
        .normalize("NFKC")
        .toLocaleLowerCase("en")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .replace(/\s+/g, " ");
    const excluded = new Set((attribute.excludeTerms ?? []).map(normalize));
    const conflicts = attribute.terms.map((term) =>
      excluded.has(normalize(term)),
    );
    if (
      conflicts.length &&
      (attribute.match === "all"
        ? conflicts.some(Boolean)
        : conflicts.every(Boolean))
    )
      throw new RetrievalError(
        `Attribute "${attribute.name}" requires evidence that it also excludes. For a negative-only preference omit terms and use excludeTerms.`,
        0,
        0,
        false,
        "CONTRADICTORY_ATTRIBUTES",
      );
  }
  if (args.category && !categories.includes(args.category))
    throw new Error(
      "Unknown category. Use one of the provided catalog categories.",
    );
  if (
    !Number.isInteger(skip) ||
    skip < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 20
  )
    throw new Error(
      "Use a nonnegative integer skip and a limit between 1 and 20.",
    );
  if (
    [args.minPrice, args.maxPrice].some(
      (value) => value !== undefined && (!Number.isFinite(value) || value < 0),
    )
  )
    throw new Error("Price bounds must be finite nonnegative numbers.");
  if (
    args.minPrice !== undefined &&
    args.maxPrice !== undefined &&
    args.minPrice > args.maxPrice
  )
    throw new Error("Minimum price cannot exceed maximum price.");
  if (
    args.excludeIds &&
    (!Array.isArray(args.excludeIds) ||
      args.excludeIds.some((id) => !Number.isInteger(id) || id < 0))
  )
    throw new Error("Excluded product IDs must be nonnegative integers.");
  return { ...args, query, brand, skip, limit, currency, attributes };
}
