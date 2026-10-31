import { it, expect, vi } from "vitest";
import { ConversationEvents } from "./conversation-events.js";
it("unsubscribes cancelled polls and releases remaining waiters on shutdown", async () => {
  const events = new ConversationEvents();
  const disconnect = new AbortController();
  const cleanup = vi.spyOn(disconnect.signal, "removeEventListener");
  const cancelled = events.wait("chat", 20_000, disconnect.signal);
  disconnect.abort();
  await cancelled;
  expect(cleanup).toHaveBeenCalledWith("abort", expect.any(Function));
  const pending = events.wait("chat", 20_000, new AbortController().signal);
  events.onModuleDestroy();
  await pending;
});
