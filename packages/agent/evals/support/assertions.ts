import type { EvalCase, Observation } from "./types.js";
export function evaluateAssertions(test: EvalCase, observed: Observation) {
  const { text, products, candidates, calls } = observed;
  const assertions: string[] = [];
  if (
    test.noSearch &&
    (products.length ||
      calls.some((c) =>
        [
          "searchProducts",
          "browseCategory",
          "searchByAttributes",
          "searchByBrand",
          "searchByPrice",
          "continueSearch",
        ].includes(c.name),
      ))
  )
    assertions.push(
      "Clarification/scope response must not retrieve or render products.",
    );
  if (
    test.mustSearch &&
    !calls.some((c) =>
      [
        "searchProducts",
        "browseCategory",
        "searchByAttributes",
        "searchByBrand",
        "searchByPrice",
        "continueSearch",
      ].includes(c.name),
    )
  )
    assertions.push("Specific request must attempt retrieval.");
  if (
    test.name.startsWith("baseline") &&
    products.some(
      (p) =>
        (p.category === "smartphones" && p.price > 500) ||
        (p.category === "fragrances" && p.price > 50),
    )
  )
    assertions.push("Baseline category-specific budget violated.");
  if (products.length > 6) assertions.push("Too many cards.");
  if (products.length && text.split(/\s+/).length > 100)
    assertions.push("Product explanation exceeds100 words.");
  if (products.length && /^\s*(?:[-*]|\d+[.)])\s/m.test(text))
    assertions.push(
      "Response duplicates a result list instead of a short paragraph.",
    );
  if (test.input.includes("$100") && products.some((p) => p.price > 100))
    assertions.push("Explicit budget violated.");
  if (
    test.expectedCandidateIds?.some(
      (id) => !candidates.some((p) => p.id === id),
    )
  )
    assertions.push("Retrieval missed expected relevant catalog IDs.");
  if (
    test.expectedPresentedIds?.some((id) => !products.some((p) => p.id === id))
  )
    assertions.push(
      "Expected relevant products were omitted from presentation.",
    );
  if (test.requiredSearchCategories) {
    const searched = new Set(
      calls.flatMap((call) => {
        const args = call.args as { category?: string; categories?: string[] };
        return args.categories ?? (args.category ? [args.category] : []);
      }),
    );
    if (
      test.requiredSearchCategories.some((category) => !searched.has(category))
    )
      assertions.push("Retrieval omitted a relevant catalog category.");
  }
  assertions.push(...(test.check?.(observed) ?? []));
  return assertions;
}
