import { sameSearchIdentity } from "@bazak/shared";
import { describe, expect, it, vi } from "vitest";
import type { Message, SearchState } from "@bazak/shared";
import { createSearchSession, searchAcrossCategories } from "../src/index.js";
import { createSearch, RateLimiter } from "../src/index.js";

const candidate = {
  id: 1,
  title: "Trainer",
  description: "Sneaker",
  category: "mens-shoes",
  price: 200,
  thumbnail: "https://example.com/shoe.png",
  brand: "Nike",
};
function savedMessage(searches: SearchState[]): Message {
  return {
    id: "saved",
    role: "assistant",
    text: "Some options",
    createdAt: new Date().toISOString(),
    searches,
  };
}
// Match the production callback's logical-key upsert; captured order becomes next turn's indices.
function recorder() {
  const states: SearchState[] = [];
  return {
    states,
    onSearch: async (state: SearchState) => {
      const index = states.findIndex((saved) =>
        sameSearchIdentity(saved, state),
      );
      if (index < 0) states.push(structuredClone(state));
      else states[index] = structuredClone(state);
    },
  };
}
describe("same-turn and persisted search cursors", () => {
  it("continues a newly-created filtered-empty search twice without resetting constraints or exceeding the shared budget", async () => {
    const records = recorder();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const skip = Number(new URL(String(input)).searchParams.get("skip"));
      return new Response(
        JSON.stringify({
          products: [
            { ...candidate, id: skip + 1, price: skip < 2 ? 200 : 75 },
          ],
          total: 3,
        }),
      );
    });
    const session = createSearchSession(
      [],
      createSearch(fetcher, new RateLimiter()),
      records,
    );
    const first = await session.retrieve({
      category: "mens-shoes",
      attributes: [
        { name: "style", terms: ["sneaker", "trainer"], match: "any" },
      ],
      brand: "Nike",
      maxPrice: 100,
      limit: 1,
    });
    expect(first).toMatchObject({ searchIndex: 0, products: [], nextSkip: 1 });
    const second = await session.continueSearch(0);
    expect(second).toMatchObject({ searchIndex: 0, products: [], nextSkip: 2 });
    const third = await session.continueSearch(0);
    expect(third).toMatchObject({
      searchIndex: 0,
      hasMore: false,
      remainingAttempts: 0,
      products: [{ id: 3, price: 75 }],
    });
    expect(records.states).toHaveLength(1);
    expect(records.states[0]).toMatchObject({
      attributes: [
        { name: "style", terms: ["sneaker", "trainer"], match: "any" },
      ],
      brand: "Nike",
      maxPrice: 100,
      skip: 2,
      hasMore: false,
    });
    await session.continueSearch(0);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(
      fetcher.mock.calls.map(([url]) =>
        new URL(String(url)).searchParams.get("skip"),
      ),
    ).toEqual(["0", "1", "2"]);
  });
  it("assigns separate current-turn indices to style categories and persists sibling cursor through next-turn continuation", async () => {
    const firstRecords = recorder();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = new URL(String(input));
      const category = url.pathname.split("/").at(-1)!;
      const skip = Number(url.searchParams.get("skip"));
      const prefix = category === "mens-shoes" ? 0 : 100;
      const products = Array.from({ length: skip ? 1 : 20 }, (_, i) => ({
        ...candidate,
        id: prefix + skip + i,
        category,
        price: 75,
      }));
      return new Response(JSON.stringify({ products, total: 21 }));
    });
    const session = createSearchSession(
      [],
      createSearch(fetcher, new RateLimiter()),
      firstRecords,
    );
    const style = await searchAcrossCategories(
      {
        categories: ["mens-shoes", "womens-shoes"],
        attributes: [
          { name: "style", terms: ["sneaker", "trainer"], match: "any" },
        ],
        maxPrice: 100,
      },
      session.retrieve,
    );
    expect(style.results).toMatchObject([
      { searchIndex: 0 },
      { searchIndex: 1 },
    ]);
    const moreMen = await session.continueSearch(0);
    expect(moreMen).toMatchObject({
      searchIndex: 0,
      hasMore: false,
      products: [{ id: 20 }],
    });
    expect(firstRecords.states).toHaveLength(2);
    expect(firstRecords.states[1]).toMatchObject({
      category: "womens-shoes",
      nextSkip: 20,
      hasMore: true,
    });
    const nextRecords = recorder();
    const next = createSearchSession(
      [savedMessage(firstRecords.states)],
      createSearch(fetcher, new RateLimiter()),
      nextRecords,
    );
    const moreWomen = await next.continueSearch(1);
    expect(moreWomen).toMatchObject({
      searchIndex: 1,
      products: [{ id: 120 }],
    });
    expect(nextRecords.states.map((s) => s.category)).toEqual([
      "mens-shoes",
      "womens-shoes",
    ]);
    expect(nextRecords.states.every((s) => !s.hasMore)).toBe(true);
  });
  it("retains prior-turn indices when a new search is added and excludes previously presented IDs", async () => {
    const previous: SearchState = {
      category: "mens-shoes",
      attributes: [
        { name: "style", terms: ["sneaker", "trainer"], match: "any" },
      ],
      skip: 0,
      limit: 1,
      nextSkip: 1,
      total: 2,
      hasMore: true,
    };
    const records = recorder();
    const old = savedMessage([previous]);
    old.products = [candidate];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const category = new URL(String(input)).pathname.split("/").at(-1)!;
      return new Response(
        JSON.stringify({ products: [{ ...candidate, category }], total: 2 }),
      );
    });
    const session = createSearchSession(
      [old],
      createSearch(fetcher, new RateLimiter()),
      records,
    );
    expect(
      await session.retrieve({
        category: "womens-shoes",
        attributes: [
          { name: "style", terms: ["sneaker", "trainer"], match: "any" },
        ],
        limit: 1,
      }),
    ).toMatchObject({ searchIndex: 1 });
    expect(await session.continueSearch(0)).toMatchObject({
      searchIndex: 0,
      products: [],
    });
    expect(records.states).toHaveLength(2);
    expect(records.states[0]).toMatchObject({
      category: "mens-shoes",
      skip: 1,
    });
  });
});

it("bounds persisted search history while keeping prompt indices aligned with continuation", async () => {
  const { contextMessages } = await import("../src/index.js");
  const states: SearchState[] = Array.from({ length: 15 }, (_, i) => ({
    query: `item-${i}`,
    skip: 0,
    limit: 1,
    total: 2,
    hasMore: true,
    nextSkip: 1,
  }));
  const saved = savedMessage(states);
  const history: Message[] = [
    { id: "u", role: "user", text: "Browse items", createdAt: saved.createdAt },
    saved,
  ];
  const prompt = JSON.stringify(contextMessages(history));
  expect(prompt).not.toContain("item-0");
  expect(prompt).toContain("item-3");
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () => new Response(JSON.stringify({ products: [], total: 2 })),
    );
  const records = recorder();
  const session = createSearchSession(
    history,
    createSearch(fetcher, new RateLimiter()),
    records,
  );
  expect(await session.continueSearch(0)).toMatchObject({ searchIndex: 0 });
  expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get("q")).toBe(
    "item-3",
  );
  expect(records.states).toHaveLength(12);
});

it("reports retrieval success and exhausted-budget failures separately for evaluator coverage evidence", async () => {
  const observations: unknown[] = [];
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () => new Response(JSON.stringify({ products: [], total: 0 })),
    );
  const session = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter()),
    {
      onResult: (result) => {
        observations.push(result);
      },
    },
  );
  for (const category of ["beauty", "fragrances", "furniture", "groceries"])
    await session.retrieve({ category });
  expect(observations).toHaveLength(4);
  expect(observations[0]).toMatchObject({
    query: { category: "beauty", currency: "USD" },
    products: [],
    hasMore: false,
    attempt: 1,
  });
  expect(observations[3]).toMatchObject({
    query: { category: "groceries" },
    error: expect.stringContaining("three"),
    remainingAttempts: 0,
    retryAllowed: false,
  });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
