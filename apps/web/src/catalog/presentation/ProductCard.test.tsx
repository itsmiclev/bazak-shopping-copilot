import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Product } from "@bazak/shared";
import { ProductCard } from "./ProductCard";

const product: Product = {
  id: 1,
  title: "Desk lamp",
  description: "An adjustable lamp.",
  price: 29.99,
  thumbnail: "https://cdn.dummyjson.com/lamp.webp",
  category: "home-decoration",
};
describe("product currency rendering", () => {
  it.each([
    ["USD", "$29.99"],
    ["EUR", "€29.99"],
    [undefined, "$29.99"],
  ])(
    "renders %s using the product's amount and currency",
    (currency, expected) => {
      const html = renderToStaticMarkup(
        <ProductCard product={{ ...product, currency }} />,
      );
      expect(html).toContain(`<strong>${expected}</strong>`);
    },
  );
});
