import type { RequestBudget } from "./request-budget.js";
export interface TransportOptions {
  sleep?: (milliseconds: number) => Promise<void>;
}
export interface CandidatePage {
  products: unknown[];
  total: number;
}
export function createCatalogTransport(
  fetcher: typeof fetch,
  budget: RequestBudget,
  options: TransportOptions = {},
) {
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  return async (url: URL, limit: number): Promise<CandidatePage> => {
    let response: Response | undefined;
    for (let localAttempt = 0; localAttempt < 2; localAttempt++) {
      budget.reserve();
      try {
        response = await fetcher(url, { signal: AbortSignal.timeout(8_000) });
      } catch {
        if (localAttempt === 0 && budget.remaining) {
          await sleep(150);
          continue;
        }
        throw budget.error(
          "The catalog could not be reached. Please try again.",
          true,
        );
      }
      if (response.ok) break;
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && localAttempt === 0 && budget.remaining) {
        await sleep(150);
        continue;
      }
      throw budget.error(
        `The catalog is temporarily unavailable (HTTP ${response.status}).`,
        retryable,
      );
    }
    let payload: unknown;
    try {
      payload = await response!.json();
    } catch {
      throw budget.error("The catalog returned an invalid response.");
    }
    if (
      !payload ||
      typeof payload !== "object" ||
      !("products" in payload) ||
      !Array.isArray(payload.products)
    )
      throw budget.error("The catalog returned an invalid product list.");
    const page = payload as CandidatePage;
    if (!Number.isInteger(page.total) || page.total < 0)
      throw budget.error("The catalog returned an invalid total count.");
    if (page.products.length > limit)
      throw budget.error(
        "The catalog returned more products than the requested page size.",
      );
    return page;
  };
}
