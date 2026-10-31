import {
  RetrievalError,
  type SearchArgs,
  type SearchExecutor,
  type SearchResult,
} from "../domain/catalog/types.js";
import { normalizeSearch } from "../domain/catalog/validation.js";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, field]) => field !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, field]) => [key, canonical(field)]),
    );
  return value;
}
function pageKey(args: SearchArgs) {
  const normalized = normalizeSearch(args);
  return JSON.stringify(
    canonical({
      ...normalized,
      brand: normalized.brand?.toLowerCase(),
      sort: normalized.sort ?? "relevance",
      attributes: (normalized.attributes ?? [])
        .map((attribute) => ({
          name: attribute.name.toLowerCase(),
          match: attribute.match ?? "any",
          terms: [
            ...new Set(
              (attribute.terms ?? []).map((term) => term.toLowerCase()),
            ),
          ].sort(),
          excludeTerms: [
            ...new Set(
              (attribute.excludeTerms ?? []).map((term) => term.toLowerCase()),
            ),
          ].sort(),
        }))
        .sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        ),
      excludeIds: [...new Set(normalized.excludeIds ?? [])].sort(
        (a, b) => a - b,
      ),
    }),
  );
}

/** One turn owns this map: successful evidence and identical in-flight work can be reused. */
export function createPageReuse(search: SearchExecutor) {
  const pages = new Map<string, Promise<SearchResult>>();
  let observedAttempt = 0;
  let observedRemaining = 3;
  function observe(attempt: number, remaining: number) {
    observedAttempt = Math.max(observedAttempt, attempt);
    observedRemaining = Math.min(observedRemaining, remaining);
  }
  async function execute(args: SearchArgs) {
    try {
      const result = await search(args);
      observe(result.attempt, result.remainingAttempts);
      return result;
    } catch (error) {
      if (error instanceof RetrievalError)
        observe(error.attempt, error.remainingAttempts);
      throw error;
    }
  }
  return async (args: SearchArgs): Promise<SearchResult> => {
    let key: string;
    try {
      key = pageKey(args);
    } catch {
      return execute(args);
    } // Let the retrieval service produce its typed validation error.
    let page = pages.get(key);
    const reused = page !== undefined;
    if (!page) {
      page = execute(args).catch((error) => {
        pages.delete(key);
        throw error;
      });
      pages.set(key, page);
    }
    const result = structuredClone(await page);
    const snapshot = search.budgetSnapshot?.() ?? {
      attempt: observedAttempt,
      remainingAttempts: observedRemaining,
    };
    return {
      ...result,
      ...snapshot,
      retryAllowed: snapshot.remainingAttempts > 0,
      ...(reused
        ? {
            reused: true,
            note: `Reused successful page evidence from this turn; no new HTTP request. Do not repeat this page. Continue its searchIndex if more candidates remain, or change constraints with the user's agreement. ${result.note}`,
          }
        : {}),
    };
  };
}
