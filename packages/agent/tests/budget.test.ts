import { expect, it, vi } from "vitest";
import { createSearch, RateLimiter } from "../src/index.js";
it("shares three reservations across sequential and simultaneous tool calls", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
    await Promise.resolve();
    return new Response(JSON.stringify({ products: [], total: 0 }));
  });
  const search = createSearch(fetcher, new RateLimiter());
  await search({ category: "groceries" });
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => search({ category: "smartphones" })),
  );
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(2);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(
    6,
  );
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("parallel transient errors and retries cannot exceed the shared request budget", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
    await Promise.resolve();
    throw new TypeError("network");
  });
  const search = createSearch(fetcher, new RateLimiter(), {
    sleep: async () => undefined,
  });
  const outcomes = await Promise.allSettled([
    search({ category: "groceries" }),
    search({ category: "smartphones" }),
  ]);
  expect(outcomes.every((outcome) => outcome.status === "rejected")).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(3);
  await expect(search({ category: "laptops" })).rejects.toMatchObject({
    remainingAttempts: 0,
    retryAllowed: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
