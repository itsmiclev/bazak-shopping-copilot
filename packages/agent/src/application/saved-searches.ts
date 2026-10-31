import type { SearchState } from "@bazak/shared";
export const MAX_SAVED_SEARCHES = 12;
export function recentSearches(states: SearchState[]) {
  return states.slice(-MAX_SAVED_SEARCHES);
}
