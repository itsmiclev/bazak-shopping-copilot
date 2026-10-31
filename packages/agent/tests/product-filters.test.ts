import { describe, expect, it, vi } from "vitest";
import type { AttributeFilter } from "@bazak/shared";
import { matchesAttributes } from "../src/domain/catalog/filters.js";
import { createSearch, RateLimiter } from "../src/index.js";
import shoes from "./fixtures/shoes.json";
const base = {
  id: 1,
  title: "",
  description: "",
  category: "",
  price: 100,
  thumbnail: "https://example.com/p.png",
};
describe("generic attribute evidence", () => {
  it("supports caller-supplied material, scent and feature vocabularies across unrelated categories", () => {
    const cases = [
      {
        product: {
          ...base,
          category: "furniture",
          title: "Solid oak chair",
          description: "Handmade wooden seat",
        },
        attribute: {
          name: "material",
          terms: ["oak", "wood"],
          match: "any" as const,
          excludeTerms: ["plastic"],
        },
      },
      {
        product: {
          ...base,
          category: "fragrances",
          title: "Vanilla citrus perfume",
          description: "Warm amber notes",
        },
        attribute: {
          name: "scent",
          terms: ["vanilla", "citrus"],
          match: "all" as const,
          excludeTerms: ["unscented"],
        },
      },
      {
        product: {
          ...base,
          category: "mens-shirts",
          title: "Linen cotton shirt",
          description: "Breathable natural fabric",
        },
        attribute: {
          name: "material",
          terms: ["linen", "cotton"],
          match: "all" as const,
          excludeTerms: ["polyester"],
        },
      },
    ];
    for (const { product, attribute } of cases) {
      expect(matchesAttributes(product, [attribute])).toBe(true);
      expect(
        matchesAttributes(
          {
            ...product,
            description: `${product.description} ${attribute.excludeTerms[0]}`,
          },
          [attribute],
        ),
      ).toBe(false);
      expect(
        matchesAttributes(
          {
            ...product,
            title: "Generic item",
            description: "No attribute details",
          },
          [attribute],
        ),
      ).toBe(false);
    }
  });
  it("uses phrase boundaries and intersects multiple attributes without invented morphology", () => {
    const product = {
      ...base,
      title: "Cottonwood red chair",
      description: "Solid oak frame",
    };
    expect(
      matchesAttributes(product, [{ name: "material", terms: ["cotton"] }]),
    ).toBe(false);
    expect(
      matchesAttributes(product, [
        { name: "material", terms: ["oak"] },
        { name: "color", terms: ["red"] },
      ]),
    ).toBe(true);
    expect(
      matchesAttributes(product, [
        { name: "material", terms: ["oak"] },
        { name: "color", terms: ["blue"] },
      ]),
    ).toBe(false);
    expect(
      matchesAttributes(product, [{ name: "style", terms: ["chairs"] }]),
    ).toBe(false);
  });
  it("recovers audited footwear via caller-provided aliases, not production shoe rules", async () => {
    const attributes: AttributeFilter[] = [
      {
        name: "style",
        terms: ["sneaker", "sneakers", "trainer", "trainers"],
        excludeTerms: ["cleats", "slippers", "heels"],
      },
    ];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const category = new URL(String(input)).pathname.split("/").at(-1);
      const products = shoes.filter((p) => p.category === category);
      return new Response(JSON.stringify({ products, total: products.length }));
    });
    const search = createSearch(fetcher, new RateLimiter());
    const men = await search({ category: "mens-shoes", attributes, limit: 20 });
    expect(men.products.map((p) => p.id)).toEqual([88, 90, 91, 92]);
    expect(men.products.every((p) => p.currency === "USD")).toBe(true);
    const women = await search({
      category: "womens-shoes",
      attributes,
      limit: 20,
    });
    expect(women.products).toEqual([]);
  });
});

it("supports exclusion-only attributes across non-shoe categories without demanding unwanted positive evidence", async () => {
  const catalog = [
    {
      ...base,
      id: 101,
      category: "beauty",
      title: "Gentle cleanser",
      description: "Fragrance-free facial wash",
    },
    {
      ...base,
      id: 102,
      category: "beauty",
      title: "Rose lipstick",
      description: "Cosmetic makeup",
    },
    {
      ...base,
      id: 103,
      category: "skin-care",
      title: "Daily moisturizer",
      description: "Face cream",
    },
  ];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const category = new URL(String(input)).pathname.split("/").at(-1);
    const products = catalog.filter((product) => product.category === category);
    return new Response(JSON.stringify({ products, total: products.length }));
  });
  const search = createSearch(fetcher, new RateLimiter());
  const attributes: AttributeFilter[] = [
    { name: "exclude makeup", excludeTerms: ["makeup", "lipstick"] },
  ];
  expect(
    (await search({ category: "beauty", attributes })).products.map(
      (product) => product.id,
    ),
  ).toEqual([101]);
  expect(
    (await search({ category: "skin-care", attributes })).products.map(
      (product) => product.id,
    ),
  ).toEqual([103]);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it("rejects unavoidable positive/exclusion contradictions before fetching, but keeps viable any-alias alternatives", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            products: [
              {
                ...base,
                category: "furniture",
                title: "Linen chair",
                description: "",
              },
            ],
            total: 1,
          }),
        ),
    );
  const search = createSearch(fetcher, new RateLimiter());
  for (const attribute of [
    { name: "material", terms: [" COTTON "], excludeTerms: ["cotton"] },
    {
      name: "material",
      terms: ["cotton", "linen"],
      match: "all" as const,
      excludeTerms: ["cotton"],
    },
  ])
    await expect(
      search({ category: "furniture", attributes: [attribute] }),
    ).rejects.toMatchObject({
      code: "CONTRADICTORY_ATTRIBUTES",
      attempt: 0,
      remainingAttempts: 3,
    });
  expect(fetcher).not.toHaveBeenCalled();
  const result = await search({
    category: "furniture",
    attributes: [
      {
        name: "material",
        terms: ["cotton", "linen"],
        match: "any",
        excludeTerms: ["cotton"],
      },
    ],
  });
  expect(result.products).toHaveLength(1);
  expect(result.attempt).toBe(1);
});
