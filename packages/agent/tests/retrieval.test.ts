import { describe, it, expect, vi } from "vitest";
import { createSearch, RateLimiter } from "../src/index.js";
const product = {
  id: 1,
  title: "Budget Phone",
  description: "A smartphone",
  price: 120,
  thumbnail: "https://example.com/image.png",
  category: "smartphones",
  brand: "Acme",
};
function response(products: unknown[], total = products.length) {
  return new Response(JSON.stringify({ products, total }));
}
const noWait = { sleep: async () => undefined };
describe("catalog retrieval", () => {
  it("uses only documented query, limit and skip parameters", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response([]));
    const search = createSearch(fetcher, new RateLimiter());
    await search({ query: "phone", maxPrice: 200, sort: "price-asc" });
    await search({
      category: "smartphones",
      maxPrice: 200,
      sort: "price-asc",
      skip: 8,
      limit: 12,
    });
    const urls = fetcher.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls[0].pathname).toBe("/products/search");
    expect(Object.fromEntries(urls[0].searchParams)).toEqual({
      q: "phone",
      limit: "8",
      skip: "0",
    });
    expect(urls[1].pathname).toBe("/products/category/smartphones");
    expect(Object.fromEntries(urls[1].searchParams)).toEqual({
      limit: "12",
      skip: "8",
    });
  });
  it("keeps every matching candidate and advances an upstream cursor without hiding matches", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const skip = Number(new URL(String(url)).searchParams.get("skip"));
      return response(
        Array.from({ length: skip ? 2 : 8 }, (_, i) => ({
          ...product,
          id: skip + i,
        })),
        10,
      );
    });
    const search = createSearch(fetcher, new RateLimiter());
    const first = await search({ category: "smartphones" });
    expect(first.products).toHaveLength(8);
    expect(first).toMatchObject({ total: 10, nextSkip: 8, hasMore: true });
    const second = await search({
      category: "smartphones",
      skip: first.nextSkip,
    });
    expect(second.products.map((p) => p.id)).toEqual([8, 9]);
    expect(second.hasMore).toBe(false);
    expect(second.nextSkip).toBeUndefined();
  });
  it("preserves pagination on a filtered-empty page and counts candidates rather than matches", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const skip = Number(new URL(String(url)).searchParams.get("skip"));
      return response(
        [{ ...product, id: skip + 1, price: skip ? 50 : 300 }],
        2,
      );
    });
    const search = createSearch(fetcher, new RateLimiter());
    const first = await search({
      category: "smartphones",
      maxPrice: 100,
      limit: 1,
    });
    expect(first).toMatchObject({
      products: [],
      total: 2,
      nextSkip: 1,
      hasMore: true,
    });
    const second = await search({ ...first.query, skip: first.nextSkip });
    expect(second.products.map((p) => p.price)).toEqual([50]);
    expect(second.hasMore).toBe(false);
  });
  it("enforces exact brand, all query terms, budget, category and exclusion constraints", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response([
          product,
          { ...product, id: 2, price: 900 },
          { ...product, id: 3, brand: "Acme Alternative" },
          { ...product, id: 4, category: "laptops" },
          { ...product, id: 5 },
          { ...product, id: 6, title: "Premium Phone" },
        ]),
      );
    const result = await createSearch(
      fetcher,
      new RateLimiter(),
    )({
      query: "budget phone",
      category: "smartphones",
      brand: " ACME ",
      minPrice: 50,
      maxPrice: 200,
      excludeIds: [5],
    });
    expect(result.products.map((p) => p.id)).toEqual([1]);
    expect(result.products[0]).toMatchObject({
      title: product.title,
      price: 120,
      score: 1,
    });
  });
  it("retries a transient failure using identical constraints and bounded injectable backoff", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(response([product]));
    const sleep = vi.fn(async (_ms: number) => undefined);
    const result = await createSearch(fetcher, new RateLimiter(), { sleep })({
      query: "phone",
      brand: "Acme",
      maxPrice: 200,
      skip: 0,
    });
    expect(result).toMatchObject({
      attempt: 2,
      remainingAttempts: 1,
      retryAllowed: true,
    });
    expect(String(fetcher.mock.calls[0][0])).toBe(
      String(fetcher.mock.calls[1][0]),
    );
    expect(sleep).toHaveBeenCalledExactlyOnceWith(150);
  });
  it("shares a strict three-HTTP-request budget across retries, pagination and intents", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response("", { status: 503 }));
    const search = createSearch(fetcher, new RateLimiter(), noWait);
    await expect(search({ query: "phone" })).rejects.toMatchObject({
      attempt: 2,
      remainingAttempts: 1,
      retryAllowed: true,
    });
    await expect(search({ query: "laptop", skip: 8 })).rejects.toMatchObject({
      attempt: 3,
      remainingAttempts: 0,
      retryAllowed: false,
    });
    await expect(search({ query: "phone" })).rejects.toThrow("three");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("retries network errors once and does not retry HTTP 400", async () => {
    const network = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("network"));
    await expect(
      createSearch(network, new RateLimiter(), noWait)({ query: "phone" }),
    ).rejects.toMatchObject({ attempt: 2, retryAllowed: true });
    expect(network).toHaveBeenCalledTimes(2);
    const badRequest = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 400 }));
    await expect(
      createSearch(badRequest, new RateLimiter(), noWait)({ query: "phone" }),
    ).rejects.toMatchObject({
      attempt: 1,
      remainingAttempts: 2,
      retryAllowed: false,
    });
    expect(badRequest).toHaveBeenCalledTimes(1);
  });
  it("returns empty matches with remaining budget for model-directed reformulation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => response([]));
    const search = createSearch(fetcher, new RateLimiter());
    const first = await search({ query: "missing" });
    expect(first).toMatchObject({
      products: [],
      hasMore: false,
      retryAllowed: true,
      remainingAttempts: 2,
    });
    await search({ query: "synonym" });
    await search({ category: "smartphones" });
    await expect(search({ query: "phone" })).rejects.toThrow("three");
  });
  it("rejects malformed payloads and invalid input without unnecessary retries", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
    const search = createSearch(fetcher, new RateLimiter(), noWait);
    for (const args of [
      { query: "phone", minPrice: 300, maxPrice: 20 },
      { query: "phone", limit: 21 },
      { query: "phone", skip: -1 },
    ])
      await expect(search(args)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    await expect(search({ query: "phone" })).rejects.toThrow(
      "invalid product list",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rate limits before each upstream request, including retries", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response("", { status: 503 }));
    await expect(
      createSearch(fetcher, new RateLimiter(1), noWait)({ query: "phone" }),
    ).rejects.toMatchObject({ attempt: 1, retryAllowed: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
