import { describe, it, expect } from "vitest";
import { mergeMessages } from "./messages";
import type { Message } from "@bazak/shared";
const msg = (id: string, text: string, createdAt: string): Message => ({
  id,
  text,
  createdAt,
  role: "assistant",
});
describe("conversation reconnect merge", () => {
  it("updates streamed messages without duplicating them or losing loaded history", () => {
    expect(
      mergeMessages(
        [msg("a", "older", "1"), msg("b", "hel", "2")],
        [msg("b", "hello", "2"), msg("c", "new", "3")],
      ),
    ).toEqual([
      msg("a", "older", "1"),
      msg("b", "hello", "2"),
      msg("c", "new", "3"),
    ]);
  });
  it("prepends older pages chronologically", () => {
    expect(
      mergeMessages([msg("b", "current", "2")], [msg("a", "old", "1")]).map(
        (m) => m.id,
      ),
    ).toEqual(["a", "b"]);
  });
});
