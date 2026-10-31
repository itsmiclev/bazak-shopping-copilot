import type { Product, AttributeFilter } from "@bazak/shared";
export interface SearchArgs {
  style?: string;
  attributes?: AttributeFilter[];
  currency?: string;
  query?: string;
  category?: string;
  brand?: string;
  skip?: number;
  limit?: number;
  excludeIds?: number[];
  minPrice?: number;
  maxPrice?: number;
  sort?: "relevance" | "price-asc" | "price-desc";
}
export interface SearchResult {
  reused?: boolean;
  products: Product[];
  query: SearchArgs;
  attempt: number;
  remainingAttempts: number;
  note: string;
  /** Upstream candidate count, before local constraints and exclusions. */
  total: number;
  nextSkip?: number;
  hasMore: boolean;
  retryAllowed: boolean;
}
export interface BudgetSnapshot {
  attempt: number;
  remainingAttempts: number;
}
export type SearchExecutor = ((args: SearchArgs) => Promise<SearchResult>) & {
  budgetSnapshot?: () => BudgetSnapshot;
};
export class RetrievalError extends Error {
  constructor(
    message: string,
    public attempt = 0,
    public remainingAttempts = 0,
    public retryAllowed = false,
    public code?: string,
  ) {
    super(message);
    this.name = "RetrievalError";
  }
}

export type RetrievalOutcome =
  | (SearchResult & { searchIndex?: number })
  | {
      products: Product[];
      error: string;
      code?: string;
      attempt?: number;
      remainingAttempts: number;
      retryAllowed: boolean;
    };
