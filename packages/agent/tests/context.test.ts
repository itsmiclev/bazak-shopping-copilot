import { it, expect } from "vitest";
import { contextMessages } from "../src/index.js";
import type { Message } from "@bazak/shared";
it("bounds prompt history while keeping latest user intent and grounded prior product details", () => {
  const history: Message[] = Array.from({ length: 1000 }, (_, i) => ({
    id: String(i),
    role: i % 2 ? "assistant" : "user",
    text: `message ${i}`,
    createdAt: new Date().toISOString(),
  }));
  history.push({
    id: "latest",
    role: "user",
    text: "Which is cheapest?",
    createdAt: new Date().toISOString(),
  });
  history[999].products = [
    {
      id: 1,
      title: "Phone",
      price: 12,
      description: "A phone",
      category: "smartphones",
      thumbnail: "x",
    },
  ];
  const context = contextMessages(history);
  expect(context.length).toBeLessThanOrEqual(30);
  expect(context.at(-1)?.content).toBe("Which is cheapest?");
  expect(JSON.stringify(context)).toContain('"price\\":12');
  expect(context[0].role).toBe("user");
});
it("caps text context at 24000 characters without dropping the latest user request", () => {
  const history: Message[] = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    role: i % 2 ? "assistant" : "user",
    text: "a".repeat(4000),
    createdAt: new Date().toISOString(),
  }));
  history.push({
    id: "latest",
    role: "user",
    text: "Under $100 please",
    createdAt: new Date().toISOString(),
  });
  const context = contextMessages(history);
  expect(
    context.reduce(
      (sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0),
      0,
    ),
  ).toBeLessThanOrEqual(24000);
  expect(context.at(-1)?.content).toBe("Under $100 please");
});
it("preserves saved pagination constraints and cursor in model context", () => {
  const messages: Message[] = [
    {
      id: "1",
      role: "user",
      text: "Browse shoes under $100",
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      role: "assistant",
      text: "Here are some options.",
      createdAt: new Date().toISOString(),
      searches: [
        {
          category: "mens-shoes",
          brand: "Nike",
          maxPrice: 100,
          skip: 0,
          limit: 4,
          nextSkip: 4,
          total: 12,
          hasMore: true,
        },
      ],
    },
    {
      id: "3",
      role: "user",
      text: "more options",
      createdAt: new Date().toISOString(),
    },
  ];
  const content = contextMessages(messages)
    .map((m) => m.content)
    .join(" ");
  expect(content).toContain('"nextSkip":4');
  expect(content).toContain('"brand":"Nike"');
  expect(content).toContain('"maxPrice":100');
});
it("advances the continuation cursor after a filtered-empty page without changing constraints", async () => {
  const { advanceSearchCursor } = await import("../src/index.js");
  const states = [
    {
      category: "mens-shoes",
      brand: "Nike",
      maxPrice: 100,
      skip: 0,
      limit: 4,
      nextSkip: 4,
      total: 12,
      hasMore: true,
    },
  ];
  advanceSearchCursor(states, 0, {
    query: {
      category: "mens-shoes",
      brand: "Nike",
      maxPrice: 100,
      skip: 4,
      limit: 4,
    },
    total: 12,
    hasMore: true,
    nextSkip: 8,
  });
  expect(states[0]).toMatchObject({
    skip: 4,
    nextSkip: 8,
    brand: "Nike",
    maxPrice: 100,
  });
  advanceSearchCursor(states, 0, {
    query: {
      category: "mens-shoes",
      brand: "Nike",
      maxPrice: 100,
      skip: 8,
      limit: 4,
    },
    total: 12,
    hasMore: false,
  });
  expect(states[0].hasMore).toBe(false);
  expect(states[0].nextSkip).toBeUndefined();
});
