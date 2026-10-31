import { expect, it, vi } from "vitest";
import {
  searchAcrossCategories,
  createSearch,
  RateLimiter,
} from "../src/index.js";
const base = {
  id: 1,
  title: "Natural cotton product",
  description: "Soft cotton material",
  price: 50,
  thumbnail: "https://example.com/p.png",
};
it("searches any three caller-selected categories under one shared budget with full constraints and per-category cursors", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const category = new URL(String(input)).pathname.split("/").at(-1);
    return new Response(
      JSON.stringify({
        products: [
          {
            ...base,
            id:
              ["furniture", "mens-shirts", "womens-dresses"].indexOf(
                category!,
              ) + 1,
            category,
          },
        ],
        total: 2,
      }),
    );
  });
  const search = createSearch(fetcher, new RateLimiter());
  const result = await searchAcrossCategories(
    {
      categories: ["furniture", "mens-shirts", "womens-dresses"],
      attributes: [{ name: "material", terms: ["cotton"] }],
      maxPrice: 100,
      limit: 1,
    },
    search,
  );
  expect(result.products).toHaveLength(3);
  expect(result.coverage).toMatchObject({
    completedCategories: ["furniture", "mens-shirts", "womens-dresses"],
    hasMoreCandidates: true,
    completeWithinQueriedCategories: false,
  });
  expect(
    result.results.every(
      (r) =>
        "query" in r &&
        r.query.maxPrice === 100 &&
        r.query.attributes?.[0].terms?.[0] === "cotton",
    ),
  ).toBe(true);
  await expect(search({ category: "groceries" })).rejects.toThrow("three");
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("does not dispatch categories from attribute names and rejects oversized category scope without fetching", async () => {
  const retrieve = vi.fn();
  await expect(
    searchAcrossCategories(
      {
        categories: [
          "furniture",
          "mens-shirts",
          "womens-dresses",
          "fragrances",
        ],
      },
      retrieve,
    ),
  ).rejects.toThrow("three");
  await expect(
    searchAcrossCategories(
      { categories: ["furniture", "furniture"] },
      retrieve,
    ),
  ).rejects.toThrow("distinct");
  expect(retrieve).not.toHaveBeenCalled();
});
it("marks partial category failures without claiming an exhaustive result", async () => {
  const retrieve = vi
    .fn()
    .mockResolvedValueOnce({
      products: [],
      query: {},
      total: 0,
      hasMore: false,
      attempt: 1,
      remainingAttempts: 2,
      retryAllowed: true,
      note: "",
    })
    .mockResolvedValueOnce({
      products: [],
      error: "Unavailable",
      remainingAttempts: 0,
      retryAllowed: false,
    });
  const result = await searchAcrossCategories(
    { categories: ["furniture", "fragrances"] },
    retrieve,
  );
  expect(result.coverage).toMatchObject({
    failedCategories: ["fragrances"],
    completeWithinQueriedCategories: false,
  });
});
