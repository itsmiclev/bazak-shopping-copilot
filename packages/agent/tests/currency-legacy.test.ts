import { expect, it, vi } from "vitest";
import {
  MessageSchema,
  ProductSchema,
  SearchStateSchema,
  sameSearchIdentity,
} from "@bazak/shared";
import {
  createSearch,
  createSearchSession,
  RateLimiter,
} from "../src/index.js";
it("rejects unsupported currencies before fetching, without spending the request budget or changing price units", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () => new Response(JSON.stringify({ products: [], total: 0 })),
    );
  const search = createSearch(fetcher, new RateLimiter());
  for (const currency of ["EUR", "ILS", "jpy"])
    await expect(
      search({ category: "fragrances", maxPrice: 100, currency }),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_CURRENCY",
      attempt: 0,
      remainingAttempts: 3,
      retryAllowed: false,
    });
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    await search({ category: "fragrances", currency: "usd" }),
  ).toMatchObject({ query: { currency: "USD" }, attempt: 1 });
});
it("loads legacy currency-free products and search states while refusing to silently discard a legacy style filter", async () => {
  const product = {
    id: 1,
    title: "Old product",
    description: "",
    price: 30,
    category: "furniture",
    thumbnail: "image",
  };
  const search = {
    category: "mens-shoes",
    style: "sneakers",
    skip: 0,
    limit: 4,
    total: 10,
    hasMore: true,
    nextSkip: 4,
  };
  const message = MessageSchema.parse({
    id: "old",
    role: "assistant",
    text: "Old search",
    createdAt: new Date().toISOString(),
    products: [product],
    searches: [search],
  });
  expect(ProductSchema.parse(product).currency).toBe("USD");
  expect(SearchStateSchema.parse(search)).toMatchObject({
    currency: "USD",
    style: "sneakers",
  });
  const fetcher = vi.fn<typeof fetch>();
  const session = createSearchSession(
    [message],
    createSearch(fetcher, new RateLimiter()),
  );
  expect(await session.continueSearch(0)).toMatchObject({
    code: "LEGACY_SEARCH_REQUIRES_REFRESH",
    products: [],
    retryAllowed: false,
  });
  expect(fetcher).not.toHaveBeenCalled();
});
it("cursor identity retains currency and complete attribute constraints with order-independent aliases", () => {
  const state = {
    category: "fragrances",
    skip: 0,
    limit: 4,
    total: 8,
    hasMore: true,
    nextSkip: 4,
    attributes: [{ name: "scent", terms: ["vanilla", "amber"] }],
  };
  expect(
    sameSearchIdentity(state, {
      ...state,
      currency: "USD",
      attributes: [
        { name: "scent", terms: ["amber", "vanilla"], match: "any" },
      ],
    }),
  ).toBe(true);
  expect(sameSearchIdentity(state, { ...state, currency: "EUR" })).toBe(false);
  expect(
    sameSearchIdentity(state, {
      ...state,
      attributes: [{ name: "scent", terms: ["vanilla"] }],
    }),
  ).toBe(false);
});

it("retains previously saved contradictory attribute evidence for inspection instead of making storage unreadable", () => {
  const legacy = SearchStateSchema.parse({
    category: "beauty",
    attributes: [
      { name: "not makeup", terms: ["makeup"], excludeTerms: ["makeup"] },
    ],
    skip: 0,
    limit: 4,
    total: 0,
    hasMore: false,
  });
  expect(legacy.attributes?.[0]).toMatchObject({
    terms: ["makeup"],
    excludeTerms: ["makeup"],
  });
});
