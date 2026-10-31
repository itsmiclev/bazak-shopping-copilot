import {
  RetrievalError,
  type SearchArgs,
  type SearchResult,
} from "../domain/catalog/types.js";
import { normalizeSearch } from "../domain/catalog/validation.js";
import { filterAndRank } from "../domain/catalog/ranking.js";
import { catalogSource } from "../infrastructure/catalog/sources.js";
import {
  createCatalogTransport,
  type TransportOptions,
} from "../infrastructure/catalog/http-client.js";
import {
  globalCatalogLimiter,
  RequestBudget,
} from "../infrastructure/catalog/request-budget.js";
export type SearchOptions = TransportOptions;
export function createSearch(
  fetcher: typeof fetch = fetch,
  limiter = globalCatalogLimiter,
  options: SearchOptions = {},
) {
  const budget = new RequestBudget(limiter);
  const fetchPage = createCatalogTransport(fetcher, budget, options);
  const search = async (input: SearchArgs): Promise<SearchResult> => {
    let args: ReturnType<typeof normalizeSearch>;
    try {
      args = normalizeSearch(input);
    } catch (error) {
      if (error instanceof RetrievalError)
        throw new RetrievalError(
          error.message,
          budget.attempts,
          budget.remaining,
          false,
          error.code,
        );
      throw budget.error(
        error instanceof Error ? error.message : "Invalid search constraints.",
      );
    }
    const page = await fetchPage(catalogSource(args), args.limit);
    const nextSkip = args.skip + page.products.length;
    const hasMore = page.products.length > 0 && nextSkip < page.total;
    return {
      products: filterAndRank(page.products, args),
      query: args,
      total: page.total,
      hasMore,
      ...(hasMore ? { nextSkip } : {}),
      attempt: budget.attempts,
      remainingAttempts: budget.remaining,
      retryAllowed: budget.remaining > 0,
      note: `${hasMore ? "More upstream candidates remain, even if this filtered page is empty. Continue this searchIndex at nextSkip without changing constraints." : "No further upstream candidates follow this page for this query. Do not paginate or repeat this completed page."} Total counts upstream candidates before local filters. Coverage is limited to the requested query and category, not other categories or preferences. Sort applies within this page, not globally. Query terms and exact brand must match; attributes use caller-supplied evidence terms and exclusions across title, description and tags. Attribute names label constraints, not verified structured catalog fields. Scores are lexical heuristics, not probabilities. Prices are USD. Three HTTP requests maximum per turn includes retries and pagination. Never silently relax price, brand, category, attributes, or currency.`,
    };
  };
  return Object.assign(search, {
    budgetSnapshot: () => ({
      attempt: budget.attempts,
      remainingAttempts: budget.remaining,
    }),
  });
}
