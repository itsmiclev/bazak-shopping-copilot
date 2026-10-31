import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPendingRequest,
  requestForRetry,
  saveConversation,
  storedConversation,
} from "./browserState";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("browser recovery pointers", () => {
  it("restores the selected conversation and keeps a lost-response retry ID across hook recreation", () => {
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("sessionStorage", storage());
    saveConversation("conversation-a");
    expect(storedConversation()).toBe("conversation-a");
    const first = requestForRetry("conversation-a", "lamp");
    expect(requestForRetry(storedConversation()!, "lamp")).toEqual(first);
    expect(requestForRetry("conversation-b", "lamp").requestId).not.toBe(
      first.requestId,
    );
    clearPendingRequest("conversation-a");
    expect(requestForRetry("conversation-a", "lamp").requestId).not.toBe(
      first.requestId,
    );
  });
  it("continues safely when browser storage is disabled", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("Blocked");
      },
      setItem() {
        throw new Error("Blocked");
      },
    });
    expect(storedConversation()).toBeNull();
    expect(() => saveConversation("a")).not.toThrow();
  });
});
