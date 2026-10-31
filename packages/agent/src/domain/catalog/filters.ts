import type { AttributeFilter } from "@bazak/shared";

/** Only catalog evidence is considered; these rules are a small vocabulary, not semantic inference. */
export interface CatalogCandidate {
  id: number;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  category: string;
  brand?: string;
  tags?: string[];
  rating?: number;
}
export function isCatalogCandidate(value: unknown): value is CatalogCandidate {
  if (!value || typeof value !== "object") return false;
  const p = value as CatalogCandidate;
  return (
    Number.isInteger(p.id) &&
    typeof p.title === "string" &&
    typeof p.description === "string" &&
    Number.isFinite(p.price) &&
    p.price >= 0 &&
    typeof p.thumbnail === "string" &&
    typeof p.category === "string"
  );
}
export function matchesPrice(
  product: CatalogCandidate,
  min?: number,
  max?: number,
) {
  return (
    (min === undefined || product.price >= min) &&
    (max === undefined || product.price <= max)
  );
}
export function matchesBrand(product: CatalogCandidate, brand?: string) {
  return (
    !brand ||
    (typeof product.brand === "string" &&
      product.brand.trim().toLowerCase() === brand.trim().toLowerCase())
  );
}
function normalizedWords(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
function containsPhrase(evidence: string, phrase: string) {
  const normalized = normalizedWords(phrase);
  return normalized.length > 0 && ` ${evidence} `.includes(` ${normalized} `);
}
export function matchesAttributes(
  product: CatalogCandidate,
  attributes: AttributeFilter[] = [],
) {
  const tags = Array.isArray(product.tags)
    ? product.tags.filter((tag) => typeof tag === "string").join(" ")
    : "";
  const evidence = normalizedWords(
    `${product.title} ${product.description} ${tags}`,
  );
  return attributes.every((attribute) => {
    if (attribute.excludeTerms?.some((term) => containsPhrase(evidence, term)))
      return false;
    const matches = (attribute.terms ?? []).map((term) =>
      containsPhrase(evidence, term),
    );
    if (!matches.length) return true;
    return attribute.match === "all"
      ? matches.every(Boolean)
      : matches.some(Boolean);
  });
}
