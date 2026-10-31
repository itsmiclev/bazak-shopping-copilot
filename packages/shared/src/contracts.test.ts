import { describe, expect, it } from "vitest";
import {
  ConversationSchema,
  MessagesResponseSchema,
  SearchStateSchema,
  SubmitMessageSchema,
  sameSearchIdentity,
} from "./index.js";

const search = {
  query: "",
  category: "mens-shoes",
  style: "sneakers" as const,
  skip: 0,
  limit: 20,
  total: 25,
  hasMore: true,
  nextSkip: 20,
};

describe("shared boundary contracts", () => {
  it("accepts trimmed messages but rejects missing identities, blank text and oversized input", () => {
    const input = {
      text: " shoes ",
      requestId: "f7d73871-5aad-4e0a-b2e7-781821b6a138",
    };
    expect(SubmitMessageSchema.parse(input).text).toBe("shoes");
    for (const invalid of [
      { ...input, text: "  " },
      { ...input, text: "a".repeat(4001) },
      { ...input, requestId: "wrong" },
    ])
      expect(SubmitMessageSchema.safeParse(invalid).success).toBe(false);
  });
  it("rejects impossible saved cursors and filters at every consumer boundary", () => {
    expect(SearchStateSchema.safeParse(search).success).toBe(true);
    for (const invalid of [
      { ...search, nextSkip: 0 },
      { ...search, nextSkip: undefined },
      { ...search, minPrice: 500, maxPrice: 100 },
      { ...search, attributes: [{ name: "material", terms: [] }] },
      { ...search, currency: "EURO" },
    ])
      expect(SearchStateSchema.safeParse(invalid).success).toBe(false);
  });
  it("identifies the same search across normalization and page changes without merging different constraints", () => {
    expect(
      sameSearchIdentity(search, {
        ...search,
        query: undefined,
        skip: 20,
        nextSkip: 40,
      }),
    ).toBe(true);
    expect(sameSearchIdentity(search, { ...search, maxPrice: 50 })).toBe(false);
    expect(sameSearchIdentity(search, { ...search, style: "formal" })).toBe(
      false,
    );
  });
  it("rejects duplicate stored message identities and malformed API responses", () => {
    const now = new Date().toISOString();
    const message = { id: "m1", role: "user", text: "shoes", createdAt: now };
    expect(
      ConversationSchema.safeParse({
        id: "c1",
        ownerId: "owner",
        title: "Shoes",
        createdAt: now,
        updatedAt: now,
        revision: 0,
        messages: [message, message],
      }).success,
    ).toBe(false);
    expect(
      MessagesResponseSchema.safeParse({
        messages: [message],
        revision: -1,
        status: "complete",
      }).success,
    ).toBe(false);
    expect(
      MessagesResponseSchema.safeParse({
        messages: [message],
        revision: 1,
        status: "complete",
      }).success,
    ).toBe(true);
  });
});
