import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageRow } from "./MessageRow";
import type { Message } from "@bazak/shared";

const result: Message = {
  id: "result",
  role: "assistant",
  text: "Here is a match.",
  status: "complete",
  createdAt: "2026-10-31",
  products: [
    {
      id: 1,
      title: "Desk lamp",
      description: "A small adjustable lamp.",
      price: 29.99,
      currency: "USD",
      thumbnail: "https://cdn.dummyjson.com/lamp.webp",
      category: "home-decoration",
    },
  ],
};
const renderMessage = (changes: Partial<Message> = {}) =>
  renderToStaticMarkup(<MessageRow message={{ ...result, ...changes }} />);

describe("in-chat product rendering", () => {
  it("renders the completed introduction before catalog cards", () => {
    const html = renderMessage();
    expect(html).toContain('class="product-card"');
    expect(html).toContain('alt="Desk lamp"');
    expect(html).toContain("$29.99");
    expect(html).toContain("A small adjustable lamp.");
    expect(html.indexOf("Here is a match.")).toBeLessThan(
      html.indexOf('class="product-card"'),
    );
  });
  it("streams text without prematurely showing available product results", () => {
    const html = renderMessage({ status: "streaming" });
    expect(html).toContain("Here is a match.");
    expect(html).not.toContain('class="product-card"');
  });
  it.each(["pending", "streaming"] as const)(
    "shows a calm status while %s has no introduction",
    (status) => {
      const html = renderMessage({ status, text: "" });
      expect(html).toContain("Choosing a few good matches…");
      expect(html).not.toContain('class="product-card"');
    },
  );
  it.each(["", "   "])(
    "does not reveal completed cards without explanatory text",
    (text) => {
      expect(renderMessage({ text })).not.toContain('class="product-card"');
    },
  );
  it("preserves cards in legacy histories that have text but no status", () => {
    expect(renderMessage({ status: undefined })).toContain(
      'class="product-card"',
    );
  });
  it("does not show misleading cards on failed responses", () => {
    const html = renderMessage({
      status: "error",
      error: "The response was interrupted.",
    });
    expect(html).toContain("The response was interrupted.");
    expect(html).not.toContain('class="product-card"');
    expect(renderMessage({ error: "Could not finish." })).not.toContain(
      'class="product-card"',
    );
  });
  it("escapes model text rather than executing HTML", () => {
    const html = renderMessage({ text: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
