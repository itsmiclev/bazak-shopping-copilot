import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ConversationStore } from "@bazak/storage";
import { createApp } from "./app.js";
import type { RunAgent } from "@bazak/agent";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function fixture(
  agent: RunAgent = async (_messages, callbacks) => {
    await callbacks.onText("Found it.");
  },
) {
  const folder = await mkdtemp(join(tmpdir(), "bazak-api-"));
  cleanup.push(() => rm(folder, { recursive: true, force: true }));
  const path = join(folder, "store.json");
  const store = await ConversationStore.open(path);
  const server = await createApp(store, agent, { pollMs: 20 });
  await server.listen(0, "127.0.0.1");
  cleanup.push(async () => {
    server.getHttpServer().closeAllConnections();
    await server.close();
  });
  const address = server.getHttpServer().address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  const owner = randomUUID();
  const request = (path: string, init: RequestInit = {}, who = owner) =>
    fetch(base + path, {
      ...init,
      headers: {
        cookie: `bazak_owner=${who}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
  const created = await request("/api/conversations", {
    method: "POST",
    body: "{}",
  });
  const conversation = await created.json();
  return { request, conversation, store, owner, path };
}
describe("HTTP and durable storage integration", () => {
  it("rejects cross-owner reads, polls, and writes", async () => {
    const { request, conversation } = await fixture();
    const other = randomUUID();
    for (const suffix of ["messages", "poll"])
      expect(
        (
          await request(
            `/api/conversations/${conversation.id}/${suffix}`,
            {},
            other,
          )
        ).status,
      ).toBe(404);
    expect(
      (
        await request(
          `/api/conversations/${conversation.id}/messages`,
          {
            method: "POST",
            body: JSON.stringify({ text: "hello", requestId: randomUUID() }),
          },
          other,
        )
      ).status,
    ).toBe(404);
  });
  it("retries an accepted request without generating a duplicate turn", async () => {
    let calls = 0;
    const { request, conversation } = await fixture(async (_, c) => {
      calls++;
      await c.onText("Hello");
    });
    const endpoint = `/api/conversations/${conversation.id}/messages`;
    const body = JSON.stringify({ text: "hello", requestId: randomUUID() });
    expect((await request(endpoint, { method: "POST", body })).status).toBe(
      202,
    );
    for (let i = 0; i < 50; i++) {
      const result = await (
        await request(`/api/conversations/${conversation.id}/poll`)
      ).json();
      if (result.status === "complete") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect((await request(endpoint, { method: "POST", body })).status).toBe(
      202,
    );
    const history = await (await request(endpoint)).json();
    expect(history.messages).toHaveLength(2);
    expect(calls).toBe(1);
  });
  it("returns 507 and does not append a turn if durable storage cannot commit", async () => {
    const { request, conversation, path, store, owner } = await fixture();
    await rm(path);
    await mkdir(path);
    const result = await request(
      `/api/conversations/${conversation.id}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ text: "hello", requestId: randomUUID() }),
      },
    );
    expect(result.status).toBe(507);
    expect(store.get(owner, conversation.id).messages).toHaveLength(0);
  });
  it("reports an error rather than an endless spinner when streaming checkpoints cannot persist", async () => {
    let failDisk: () => Promise<void> = async () => undefined;
    const { request, conversation, path } = await fixture(
      async (_, callbacks) => {
        await failDisk();
        await callbacks.onText("Partial");
      },
    );
    failDisk = async () => {
      await rm(path);
      await mkdir(path);
    };
    await request(`/api/conversations/${conversation.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text: "hello", requestId: randomUUID() }),
    });
    let result: {
      status: string;
      messages: { status: string; error?: string }[];
    } = { status: "streaming", messages: [] };
    for (let i = 0; i < 50; i++) {
      result = await (
        await request(`/api/conversations/${conversation.id}/poll`)
      ).json();
      if (result.status === "error") break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(result.status).toBe("error");
    expect(result.messages.at(-1)?.status).toBe("error");
    expect(result.messages.at(-1)?.error).toBeTruthy();
  });
  it("paginates 1000 messages in exact 20-message batches without duplication", async () => {
    const { request, conversation, store, owner } = await fixture();
    await store.update(owner, conversation.id, (c) => {
      c.messages = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i),
        role: i % 2 ? "assistant" : "user",
        text: `Message ${i}`,
        createdAt: new Date().toISOString(),
        status: "complete",
      }));
    });
    let cursor: string | undefined;
    const ids: string[] = [];
    let pages = 0;
    do {
      const result = await (
        await request(
          `/api/conversations/${conversation.id}/messages${cursor ? `?before=${cursor}` : ""}`,
        )
      ).json();
      expect(result.messages).toHaveLength(20);
      ids.unshift(...result.messages.map((m: { id: string }) => m.id));
      cursor = result.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(50);
    expect(ids).toEqual(Array.from({ length: 1000 }, (_, i) => String(i)));
  });
});
