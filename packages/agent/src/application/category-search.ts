import type { SearchArgs, RetrievalOutcome } from "../domain/catalog/types.js";
import { categories as catalogCategories } from "../domain/catalog/categories.js";
export type AcrossCategoriesArgs = Omit<SearchArgs, "category" | "style"> & {
  categories: string[];
};
export async function searchAcrossCategories(
  args: AcrossCategoriesArgs,
  retrieve: (args: SearchArgs) => Promise<RetrievalOutcome>,
) {
  const { categories, ...constraints } = args;
  if (
    !Array.isArray(categories) ||
    !categories.length ||
    categories.length > 3 ||
    new Set(categories).size !== categories.length ||
    categories.some((category) => !catalogCategories.includes(category))
  )
    throw new Error(
      "Choose one to three distinct supported catalog categories.",
    );
  const results: RetrievalOutcome[] = [];
  const completedCategories: string[] = [];
  const failedCategories: string[] = [];
  for (const category of categories) {
    const result = await retrieve({
      ...constraints,
      category,
      skip: constraints.skip ?? 0,
      limit: constraints.limit ?? 20,
    });
    results.push(result);
    if ("error" in result) failedCategories.push(category);
    else completedCategories.push(category);
  }
  const products = [
    ...new Map(
      results
        .flatMap((result) => result.products)
        .map((product) => [product.id, product]),
    ).values(),
  ];
  const hasMoreCandidates = results.some(
    (result) => "hasMore" in result && result.hasMore,
  );
  return {
    products,
    results,
    coverage: {
      scope: "Only the caller-selected categories and supplied constraints",
      requestedCategories: categories,
      completedCategories,
      failedCategories,
      hasMoreCandidates,
      completeWithinQueriedCategories:
        !failedCategories.length && !hasMoreCandidates,
    },
    note: "Attribute matches are evidence-term matches, not semantic or structured-attribute certainty. Coverage applies only to the requested categories and constraints; it does not establish absence in other categories. Each result has its own continuation cursor. All requests share the turn budget.",
  };
}
