import { describe, expect, it } from "vitest";
import { formatPrice } from "./formatPrice";

describe("catalog price formatting", () => {
  it("distinguishes USD and EUR without changing the numeric amount", () => {
    expect(formatPrice(29.99, "USD")).toBe("$29.99");
    expect(formatPrice(29.99, "EUR")).toBe("€29.99");
  });
  it("uses USD for legacy products with no currency", () => {
    expect(formatPrice(29.99)).toBe("$29.99");
    expect(formatPrice(29.99, undefined)).toBe("$29.99");
  });
  it("uses the currency's fraction digits", () => {
    expect(formatPrice(2000, "JPY")).toBe("¥2,000");
  });
});
