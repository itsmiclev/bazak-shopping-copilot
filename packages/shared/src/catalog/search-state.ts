import { z } from "zod";
import { CATALOG_CURRENCY, CurrencyCodeSchema } from "./product.js";

export const AttributeFilterSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    terms: z
      .array(z.string().trim().min(1).max(100))
      .max(12)
      .default([])
      .describe(
        "Positive evidence terms. Omit for exclusion-only constraints; never put an unwanted term here.",
      ),
    match: z.enum(["any", "all"]).default("any"),
    excludeTerms: z
      .array(z.string().trim().min(1).max(100))
      .max(12)
      .optional()
      .describe(
        "Negative evidence: reject a candidate if any of these phrases occur.",
      ),
  })
  .refine(
    (attribute) =>
      attribute.terms.length > 0 || (attribute.excludeTerms?.length ?? 0) > 0,
    "Provide positive terms or exclusion terms.",
  );
export type AttributeFilter = z.input<typeof AttributeFilterSchema>;
export const SearchStateSchema = z
  .object({
    style: z.string().optional(), // Read legacy records without silently reinterpreting their old filter.
    attributes: z.array(AttributeFilterSchema).max(6).optional(),
    currency: CurrencyCodeSchema.default(CATALOG_CURRENCY),
    query: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    minPrice: z.number().finite().nonnegative().optional(),
    maxPrice: z.number().finite().nonnegative().optional(),
    sort: z.enum(["relevance", "price-asc", "price-desc"]).optional(),
    skip: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(20),
    nextSkip: z.number().int().nonnegative().optional(),
    total: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  })
  .refine(
    (s) =>
      s.minPrice === undefined ||
      s.maxPrice === undefined ||
      s.minPrice <= s.maxPrice,
    "Invalid price range",
  )
  .refine(
    (s) => s.nextSkip === undefined || s.nextSkip > s.skip,
    "Cursor must advance",
  )
  .refine(
    (s) => !s.hasMore || s.nextSkip !== undefined,
    "More results need a cursor",
  );
export type SearchState = z.input<typeof SearchStateSchema>;

const identityFields = [
  "category",
  "style",
  "brand",
  "minPrice",
  "maxPrice",
  "sort",
  "limit",
] as const;
function attributeIdentity(attributes: AttributeFilter[] = []) {
  const normalize = (terms: string[]) =>
    [...new Set(terms.map((term) => term.trim().toLowerCase()))].sort();
  return JSON.stringify(
    attributes
      .map((attribute) => ({
        name: attribute.name.trim().toLowerCase(),
        match: attribute.match ?? "any",
        terms: normalize(attribute.terms ?? []),
        excludeTerms: normalize(attribute.excludeTerms ?? []),
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}
export function sameSearchIdentity(left: SearchState, right: SearchState) {
  return (
    (left.query ?? "") === (right.query ?? "") &&
    (left.currency ?? CATALOG_CURRENCY).toUpperCase() ===
      (right.currency ?? CATALOG_CURRENCY).toUpperCase() &&
    attributeIdentity(left.attributes) ===
      attributeIdentity(right.attributes) &&
    identityFields.every((key) => left[key] === right[key])
  );
}
