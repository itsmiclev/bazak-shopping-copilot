import { createPageReuse } from "./page-reuse.js";
import { recentSearches } from "./saved-searches.js";
import { sameSearchIdentity } from "@bazak/shared";
import type { Message, Product, SearchState } from "@bazak/shared";
import type { AgentCallbacks } from "./contracts.js";
import {
  RetrievalError,
  type RetrievalOutcome,
  type SearchArgs,
  type SearchResult,
  type SearchExecutor,
} from "../domain/catalog/types.js";
/** Advance a logical search even when its current candidate page has no matching products. */
export function advanceSearchCursor(
  states: SearchState[],
  index: number,
  result: {
    query: SearchArgs;
    total: number;
    hasMore: boolean;
    nextSkip?: number;
  },
) {
  const old = states[index];
  if (!old) return;
  const { excludeIds: _excluded, ...query } = result.query;
  states[index] = {
    ...old,
    ...query,
    total: result.total,
    hasMore: result.hasMore,
    nextSkip: result.nextSkip,
  };
}

/** Stable indices cover both saved searches and searches started during this turn. */
export function createSearchSession(
  messages: Message[],
  search: SearchExecutor,
  callbacks: Pick<AgentCallbacks, "onCandidates" | "onSearch"> & {
    onResult?: AgentCallbacks["onRetrievalResult"];
  } = {},
) {
  const fetchPage = createPageReuse(search);
  const states: SearchState[] = structuredClone(
    recentSearches(
      [...messages].reverse().find((m) => m.searches?.length)?.searches ?? [],
    ),
  ).map((state) => ({ ...state, query: state.query ?? "" }));
  let publications: Promise<void> = Promise.resolve();
  function publishStates() {
    const publication = publications.then(async () => {
      for (const saved of structuredClone(states))
        await callbacks.onSearch?.(saved);
    });
    publications = publication.catch(() => undefined);
    return publication;
  }
  const shownIds = new Set(
    messages.flatMap((m) => m.products?.map((p) => p.id) ?? []),
  );
  const continuing = new Set<number>();
  async function retrieve(
    args: SearchArgs,
    existingIndex?: number,
  ): Promise<RetrievalOutcome> {
    let outcome: RetrievalOutcome;
    try {
      const result = await fetchPage(args);
      const { excludeIds: _excluded, ...stateArgs } = result.query;
      const state: SearchState = {
        ...stateArgs,
        skip: result.query.skip ?? 0,
        limit: result.query.limit ?? 8,
        total: result.total,
        hasMore: result.hasMore,
        nextSkip: result.nextSkip,
      };
      const foundIndex =
        existingIndex ??
        states.findIndex((saved) => sameSearchIdentity(saved, state));
      const searchIndex = foundIndex < 0 ? states.length : foundIndex;
      const saved = states[searchIndex];
      const preserveAdvancedCursor =
        result.reused && saved && saved.skip > state.skip;
      if (!preserveAdvancedCursor) states[searchIndex] = state;
      await callbacks.onCandidates?.(result.products);
      // Preserve the complete indexed registry, including a sibling category not continued this turn.
      // Snapshot copies prevent later cursor updates from mutating already-published callback values.
      await publishStates();
      outcome = {
        ...result,
        searchIndex,
        ...(preserveAdvancedCursor
          ? {
              hasMore: saved.hasMore,
              nextSkip: saved.nextSkip,
              note: `${result.note} Continuation retains the furthest page already inspected this turn.`,
            }
          : {}),
      };
    } catch (error) {
      outcome = {
        products: [],
        error:
          error instanceof RetrievalError
            ? error.message
            : "Catalog search could not be completed.",
        code: error instanceof RetrievalError ? error.code : undefined,
        attempt: error instanceof RetrievalError ? error.attempt : undefined,
        remainingAttempts:
          error instanceof RetrievalError ? error.remainingAttempts : 0,
        retryAllowed:
          error instanceof RetrievalError ? error.retryAllowed : false,
      };
    }
    await callbacks.onResult?.({
      query: structuredClone(args),
      ...structuredClone(outcome),
    });
    return outcome;
  }
  return {
    retrieve,
    markPresented(products: Product[]) {
      for (const product of products) shownIds.add(product.id);
    },
    async continueSearch(searchIndex: number) {
      const state = states[searchIndex];
      if (!state)
        return {
          products: [],
          error:
            "No search exists at this index. Use the searchIndex returned by retrieval or an index from saved searches.",
        };
      if (!state.hasMore || state.nextSkip === undefined)
        return {
          products: [],
          searchIndex,
          hasMore: false,
          note: "No further page for this search. Offer to change a preference, without repeating products.",
        };
      if (continuing.has(searchIndex))
        return {
          products: [],
          searchIndex,
          error:
            "This search page is already being retrieved. Wait for its result before continuing again.",
        };
      continuing.add(searchIndex);
      try {
        const { total: _total, hasMore: _hasMore, nextSkip, ...args } = state;
        return await retrieve(
          { ...args, skip: nextSkip, excludeIds: [...shownIds] },
          searchIndex,
        );
      } finally {
        continuing.delete(searchIndex);
      }
    },
  };
}
