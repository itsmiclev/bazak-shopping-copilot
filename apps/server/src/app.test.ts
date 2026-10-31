import { afterEach, describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { ConversationStore } from "@bazak/storage";
import { createApp } from "./app.js";
import { createSearch, RateLimiter, type RunAgent } from "@bazak/agent";
import {
  ApiErrorSchema,
  MessagesResponseSchema,
  SubmitMessageResponseSchema,
} from "@bazak/shared";
const servers: INestApplication[] = [],
  dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(async (app) => {
      app.getHttpServer().closeAllConnections();
      await app.close();
    }),
  );
  await Promise.all(
    dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
  );
});
async function setup(agent: RunAgent, pollMs = 10) {
  const dir = await mkdtemp(join(tmpdir(), "bazak-api-"));
  dirs.push(dir);
  const store = await ConversationStore.open(join(dir, "db.json"));
  const server = await createApp(store, agent, { pollMs });
  servers.push(server);
  await server.listen(0, "127.0.0.1");
  const address = server.getHttpServer().address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const initial = await fetch(`${base}/api/conversations`, {
    method: "POST",
    body: "{}",
  });
  const cookie = initial.headers.get("set-cookie")!.split(";")[0];
  const conversation = await initial.json();
  const request = (path: string, init: RequestInit = {}) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { cookie, "content-type": "application/json", ...init.headers },
    });
  return { store, request, id: conversation.id, base };
}
async function completed(
  request: (path: string) => Promise<Response>,
  id: string,
) {
  let result: any;
  for (let i = 0; i < 30; i++) {
    result = await (
      await request(
        `/api/conversations/${id}/poll?after=${result?.revision ?? -1}`,
      )
    ).json();
    if (result.status !== "streaming") return result;
  }
  throw new Error("Generation did not complete");
}
describe("HTTP chat flow", () => {
  it("streams text first and publishes selected cards only on completion, retaining search cursors", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let ready!: () => void;
    const checkpoint = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const { request, id } = await setup(async (_, cb) => {
      await cb.onSearch?.({
        query: "shoe",
        skip: 0,
        limit: 8,
        total: 16,
        hasMore: true,
        nextSkip: 8,
      });
      await cb.onProducts([
        {
          id: 1,
          title: "Shoe",
          description: "Casual",
          price: 40,
          thumbnail: "https://example.com/shoe.png",
          category: "mens-shoes",
        },
      ]);
      await cb.onText("These lean toward the casual style you described.");
      ready();
      await gate;
      await cb.onSearch?.({
        query: "shoe",
        skip: 8,
        limit: 8,
        total: 24,
        hasMore: true,
        nextSkip: 16,
      });
    });
    await request(`/api/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text: "casual shoes", requestId: randomUUID() }),
    });
    await checkpoint;
    try {
      const streaming = await (
        await request(`/api/conversations/${id}/messages`)
      ).json();
      expect(streaming.messages[1].text).toContain("casual style");
      expect(streaming.messages[1].products).toEqual([]);
      expect(streaming.messages[1].status).toBe("streaming");
    } finally {
      release();
    }
    const final = await completed(request, id);
    expect(final.messages[1].products.map((p: { id: number }) => p.id)).toEqual(
      [1],
    );
    expect(final.messages[1].searches).toHaveLength(1);
    expect(final.messages[1].searches[0].nextSkip).toBe(16);
  });
  it("persists input, retrieved cards and text; refresh resumes; retry is idempotent; other owner cannot access", async () => {
    let calls = 0;
    const search = createSearch(
      async () =>
        new Response(
          JSON.stringify({
            total: 1,
            products: [
              {
                id: 7,
                title: "Phone",
                description: "Small phone",
                price: 100,
                thumbnail: "https://example.com/a.png",
                category: "smartphones",
              },
            ],
          }),
        ),
      new RateLimiter(),
    );
    const { request, id, base } = await setup(async (messages, cb) => {
      calls++;
      expect(messages.at(-1)?.text).toBe("phone");
      const result = await search({ query: "phone", maxPrice: 200 });
      await cb.onProducts(result.products);
      await cb.onText("Found a phone.");
    });
    const input = JSON.stringify({ text: "phone", requestId: randomUUID() });
    expect(
      (
        await request(`/api/conversations/${id}/messages`, {
          method: "POST",
          body: input,
        })
      ).status,
    ).toBe(202);
    const result = await completed(request, id);
    expect(result.messages[1].products[0].id).toBe(7);
    expect(result.messages[1].text).toBe("Found a phone.");
    const refreshed = await (
      await request(`/api/conversations/${id}/messages`)
    ).json();
    expect(refreshed.messages).toEqual(result.messages);
    await request(`/api/conversations/${id}/messages`, {
      method: "POST",
      body: input,
    });
    expect(calls).toBe(1);
    expect(
      (await fetch(`${base}/api/conversations/${id}/messages`)).status,
    ).toBe(404);
    const history = await (await request("/api/conversations")).json();
    expect(history.conversations[0].title).toBe("phone");
  });
  it("reports generation failure and releases the conversation", async () => {
    const { request, id } = await setup(async (_, cb) => {
      await cb.onProducts([
        {
          id: 1,
          title: "Shoe",
          description: "Casual",
          price: 40,
          thumbnail: "https://example.com/shoe.png",
          category: "mens-shoes",
        },
      ]);
      throw new Error("secret-provider-internals");
    });
    await request(`/api/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text: "hello", requestId: randomUUID() }),
    });
    const result = await completed(request, id);
    expect(result.status).toBe("error");
    expect(result.messages[1].error).not.toContain("secret");
    expect(result.messages[1].products).toEqual([]);
  });
  it("rejects invalid messages and untrusted origins", async () => {
    const { request, id } = await setup(async () => {});
    expect(
      (
        await request(`/api/conversations/${id}/messages`, {
          method: "POST",
          body: "{}",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/api/conversations", {
          method: "POST",
          headers: { origin: "https://evil.example" },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  });
});

describe("Nest request boundary", () => {
  it("uses shared message validation and rejects malformed or oversized JSON without appending history", async () => {
    const { request, id } = await setup(async () => {});
    const endpoint = `/api/conversations/${id}/messages`;
    const invalid = [
      null,
      { text: "   ", requestId: randomUUID() },
      { text: "x".repeat(4001), requestId: randomUUID() },
      { text: "hello", requestId: "not-a-uuid" },
    ];
    for (const input of invalid) {
      const response = await request(endpoint, {
        method: "POST",
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(400);
      expect(ApiErrorSchema.safeParse(await response.json()).success).toBe(
        true,
      );
    }
    const malformed = await request(endpoint, {
      method: "POST",
      body: '{"text":',
    });
    expect(malformed.status).toBe(400);
    expect(ApiErrorSchema.safeParse(await malformed.json()).success).toBe(true);
    const oversized = await request(endpoint, {
      method: "POST",
      body: JSON.stringify({
        text: "x".repeat(20_000),
        requestId: randomUUID(),
      }),
    });
    expect(oversized.status).toBe(413);
    expect(ApiErrorSchema.safeParse(await oversized.json()).success).toBe(true);
    const history = MessagesResponseSchema.parse(
      await (await request(endpoint)).json(),
    );
    expect(history.messages).toEqual([]);
  });
  it("trims valid input with the shared schema and preserves the response contract", async () => {
    const { request, id } = await setup(async (messages, callbacks) => {
      expect(messages.at(-1)?.text).toBe("phone");
      await callbacks.onText("Let’s find one.");
    });
    const response = await request(`/api/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text: "  phone  ", requestId: randomUUID() }),
    });
    expect(response.status).toBe(202);
    expect(
      SubmitMessageResponseSchema.parse(await response.json()).conversationId,
    ).toBe(id);
    expect(
      MessagesResponseSchema.safeParse(await completed(request, id)).success,
    ).toBe(true);
  });
  it("rejects a concurrent turn while a disconnected poll does not cancel generation", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { request, id } = await setup(async (_, callbacks) => {
      await gate;
      await callbacks.onText("Generation survived reconnect.");
    }, 1000);
    const endpoint = `/api/conversations/${id}/messages`;
    await request(endpoint, {
      method: "POST",
      body: JSON.stringify({ text: "hello", requestId: randomUUID() }),
    });
    try {
      const duplicate = await request(endpoint, {
        method: "POST",
        body: JSON.stringify({ text: "another turn", requestId: randomUUID() }),
      });
      expect(duplicate.status).toBe(409);
      const page = await (await request(endpoint)).json();
      const disconnect = new AbortController();
      const poll = request(
        `/api/conversations/${id}/poll?after=${page.revision}`,
        { signal: disconnect.signal },
      );
      disconnect.abort();
      await expect(poll).rejects.toThrow();
    } finally {
      release();
    }
    const final = await completed(request, id);
    expect(final.status).toBe("complete");
    expect(final.messages.at(-1).text).toBe("Generation survived reconnect.");
  });
  it("returns typed errors for invalid query parameters and issues an HttpOnly anonymous cookie", async () => {
    const { request, id, base } = await setup(async () => {});
    const response = await request(
      `/api/conversations/${id}/poll?after=not-a-revision`,
    );
    expect(response.status).toBe(400);
    expect(ApiErrorSchema.safeParse(await response.json()).success).toBe(true);
    expect(
      (await request(`/api/conversations/${id}/messages?before=a&before=b`))
        .status,
    ).toBe(400);
    const fresh = await fetch(`${base}/api/conversations`);
    expect(fresh.headers.get("set-cookie")).toContain("HttpOnly");
    expect(fresh.headers.get("set-cookie")).toContain("SameSite=Strict");
    expect(fresh.headers.get("cache-control")).toBe("no-store");
  });
});
