import { afterEach, it, expect, vi } from "vitest";
import type { Conversation } from "@bazak/shared";
import { GenerationState } from "./generation-state.js";
const conversation = (id: string): Conversation => ({
  id,
  ownerId: "owner",
  title: "Chat",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [],
  revision: 0,
});
afterEach(() => vi.useRealTimers());
it("enforces global concurrency and rolling turn limits while releasing completed turns", () => {
  vi.useFakeTimers();
  const state = new GenerationState();
  for (let i = 0; i < 3; i++) state.admit(conversation(String(i)));
  expect(() => state.admit(conversation("fourth"))).toThrow("Too many");
  for (let i = 0; i < 3; i++) state.release(String(i));
  for (let i = 3; i < 12; i++) {
    state.admit(conversation(String(i)));
    state.release(String(i));
  }
  expect(() => state.admit(conversation("thirteenth"))).toThrow("Too many");
  vi.advanceTimersByTime(60_001);
  expect(() => state.admit(conversation("after-window"))).not.toThrow();
});
