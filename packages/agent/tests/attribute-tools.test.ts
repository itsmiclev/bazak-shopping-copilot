import { expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createSearch,
  RateLimiter,
  createSearchSession,
  createProductSelection,
} from "../src/index.js";
import { createShoppingTools } from "../src/tools/index.js";
import shoes from "./fixtures/shoes.json";
function fixture() {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const category = new URL(String(input)).pathname.split("/").at(-1);
    const products = shoes.filter((p) => p.category === category);
    return new Response(JSON.stringify({ products, total: products.length }));
  });
  const callbacks = {
    onText: async () => undefined,
    onProducts: async () => undefined,
  };
  const session = createSearchSession(
    [],
    createSearch(fetcher, new RateLimiter()),
  );
  return {
    fetcher,
    tools: createShoppingTools({
      session,
      selection: createProductSelection(),
      callbacks,
    }),
  };
}
const options = { toolCallId: "test", messages: [], context: {} };
const constraints = {
  categories: ["mens-shoes"],
  currency: "USD",
  attributes: [
    {
      name: "style",
      terms: ["sneaker", "sneakers", "trainer", "trainers"],
      match: "any" as const,
      excludeTerms: ["cleats"],
    },
  ],
};
it("brand and price tools intersect all generic attribute constraints under the same three-request budget", async () => {
  const { tools, fetcher } = fixture();
  expect(
    await tools.searchByBrand.execute!(
      { ...constraints, brand: "Nike", maxPrice: 200 },
      options,
    ),
  ).toMatchObject({ products: [{ id: 88 }] });
  expect(
    await tools.searchByPrice.execute!(
      { ...constraints, brand: "Nike", maxPrice: 100 },
      options,
    ),
  ).toMatchObject({ products: [] });
  expect(
    await tools.searchByPrice.execute!(
      { ...constraints, maxPrice: 100 },
      options,
    ),
  ).toMatchObject({ products: [{ id: 90 }] });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it("tool schemas require category scope and attribute evidence where appropriate", () => {
  const { tools } = fixture();
  expect(
    (tools.searchByBrand.inputSchema as z.ZodType).safeParse({ brand: "Nike" })
      .success,
  ).toBe(false);
  expect(
    (tools.searchByPrice.inputSchema as z.ZodType).safeParse({ maxPrice: 100 })
      .success,
  ).toBe(false);
  expect(
    (tools.searchByPrice.inputSchema as z.ZodType).safeParse({
      categories: ["smartphones"],
    }).success,
  ).toBe(false);
  expect(
    (tools.searchByAttributes.inputSchema as z.ZodType).safeParse({
      categories: ["furniture"],
      attributes: [],
    }).success,
  ).toBe(false);
  expect(
    (tools.searchByAttributes.inputSchema as z.ZodType).safeParse({
      categories: ["fragrances"],
      attributes: [{ name: "scent", terms: ["vanilla", "amber"] }],
    }).success,
  ).toBe(true);
});
