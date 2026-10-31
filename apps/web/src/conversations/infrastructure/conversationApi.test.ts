import { afterEach, describe, expect, it, vi } from "vitest";
import { conversationApi, HttpError } from "./conversationApi";
afterEach(() => vi.unstubAllGlobals());
describe("shared HTTP contracts at the browser boundary", () => {
  it("rejects a response with missing revision rather than corrupting the cache", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ messages: [], status: "complete" }), {
            status: 200,
          }),
        ),
    );
    await expect(conversationApi.messages("a")).rejects.toThrow(
      "unexpected response",
    );
  });
  it("exposes a typed server failure without losing its status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: "Another response is still running." }),
            { status: 409 },
          ),
        ),
    );
    await expect(
      conversationApi.submit("a", {
        text: "hello",
        requestId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toMatchObject({
      message: "Another response is still running.",
      status: 409,
    });
  });
});
