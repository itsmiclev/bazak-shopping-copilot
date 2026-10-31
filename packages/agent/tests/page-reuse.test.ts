import { expect, it, vi } from "vitest";
import {
  createSearch,
  createSearchSession,
  RateLimiter,
} from "../src/index.js";
const empty = () => new Response(JSON.stringify({ products: [], total: 0 }));
it("reuses a completed empty page without another HTTP request and reports the current shared budget", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => empty());
  const session = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter()),
  );
  const first = await session.retrieve({
    category: "fragrances",
    maxPrice: 100,
  });
  expect(first).toMatchObject({
    products: [],
    hasMore: false,
    attempt: 1,
    remainingAttempts: 2,
  });
  await session.retrieve({ category: "groceries" });
  expect(
    await session.retrieve({
      category: "fragrances",
      maxPrice: 100,
      currency: "usd",
      skip: 0,
      limit: 8,
    }),
  ).toMatchObject({
    reused: true,
    searchIndex: 0,
    products: [],
    attempt: 2,
    remainingAttempts: 1,
  });
  await session.retrieve({ category: "furniture" });
  expect(
    await session.retrieve({ category: "fragrances", maxPrice: 100 }),
  ).toMatchObject({
    reused: true,
    attempt: 3,
    remainingAttempts: 0,
    retryAllowed: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("shares identical parallel in-flight work but never caches across turns", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
    await Promise.resolve();
    return empty();
  });
  const session = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter()),
  );
  const results = await Promise.all([
    session.retrieve({ category: "furniture" }),
    session.retrieve({ category: "furniture" }),
  ]);
  expect(results).toMatchObject([{ attempt: 1 }, { reused: true, attempt: 1 }]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const nextTurn = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter()),
  );
  await nextTurn.retrieve({ category: "furniture" });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it.each([
  { category: "furniture", maxPrice: 80 },
  { category: "furniture", skip: 8 },
  { category: "furniture", limit: 4 },
  { category: "furniture", excludeIds: [1] },
  { category: "furniture", attributes: [{ name: "material", terms: ["oak"] }] },
  { category: "furniture", brand: "Acme" },
])(
  "does not reuse evidence after changing page or constraints: %j",
  async (changed) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => empty());
    const session = createSearchSession(
      [],
      createSearch(fetcher, new RateLimiter()),
    );
    await session.retrieve({ category: "furniture" });
    const result = await session.retrieve(changed);
    expect(result).not.toHaveProperty("reused");
    expect(fetcher).toHaveBeenCalledTimes(2);
  },
);
it("validates changed currency instead of reusing USD evidence", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => empty());
  const session = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter()),
  );
  await session.retrieve({ category: "furniture" });
  expect(
    await session.retrieve({ category: "furniture", currency: "EUR" }),
  ).toMatchObject({ code: "UNSUPPORTED_CURRENCY", attempt: 1 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not cache failed requests, preserving a genuine subsequent retry", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockImplementation(async () => empty());
  const session = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter(), { sleep: async () => undefined }),
  );
  expect(await session.retrieve({ category: "furniture" })).toMatchObject({
    error: expect.any(String),
    attempt: 2,
  });
  expect(await session.retrieve({ category: "furniture" })).toMatchObject({
    products: [],
    attempt: 3,
  });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("reusing an earlier page cannot rewind a search that has already advanced", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const skip = Number(new URL(String(input)).searchParams.get("skip"));
    return new Response(
      JSON.stringify({
        products: [
          {
            id: skip + 1,
            title: "Chair",
            description: "",
            category: "furniture",
            price: 10,
            thumbnail: "image",
          },
        ],
        total: 3,
      }),
    );
  });
  const session = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter()),
  );
  await session.retrieve({ category: "furniture", limit: 1 });
  await session.continueSearch(0);
  expect(
    await session.retrieve({ category: "furniture", limit: 1 }),
  ).toMatchObject({ reused: true, nextSkip: 2 });
  expect(await session.continueSearch(0)).toMatchObject({
    products: [{ id: 3 }],
    hasMore: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it("normalizes equivalent attribute aliases and defaults while keeping completed-page guidance factual", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => empty());
  const session = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter()),
  );
  const first = await session.retrieve({
    category: "fragrances",
    attributes: [{ name: "scent", terms: ["Vanilla", "amber"] }],
  });
  expect(first).toMatchObject({
    hasMore: false,
    note: expect.stringContaining(
      "Do not paginate or repeat this completed page",
    ),
  });
  const second = await session.retrieve({
    category: "fragrances",
    sort: "relevance",
    currency: "USD",
    attributes: [{ name: "scent", match: "any", terms: ["amber", "vanilla"] }],
    excludeIds: [],
  });
  expect(second).toMatchObject({
    reused: true,
    attempt: 1,
    remainingAttempts: 2,
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
