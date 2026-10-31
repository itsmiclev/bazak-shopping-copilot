export { runAgent } from "./agent.js";
export type { RunAgent, AgentCallbacks } from "./application/contracts.js";
export { MODEL, model } from "./infrastructure/openai/model.js";
export { SYSTEM } from "./prompt.js";
export { contextMessages } from "./application/context.js";
export {
  createSearchSession,
  advanceSearchCursor,
} from "./application/search-session.js";
export { createProductSelection } from "./application/selection.js";
export { searchAcrossCategories } from "./application/category-search.js";
export { createSearch } from "./application/search.js";
export {
  RateLimiter,
  RequestBudget,
} from "./infrastructure/catalog/request-budget.js";
export { RetrievalError } from "./domain/catalog/types.js";
export type { SearchArgs, SearchResult } from "./domain/catalog/types.js";
export { categories as CATALOG_CATEGORIES } from "./domain/catalog/categories.js";
