import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConversationStore } from "./index";
const folders: string[] = [];
async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), "bazak-store-"));
  folders.push(folder);
  const path = join(folder, "store.json");
  return { path, store: await ConversationStore.open(path) };
}
afterEach(async () => {
  await Promise.all(
    folders.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
describe("durable conversation store", () => {
  it("persists across restart and isolates owners and mutable copies", async () => {
    const { store, path } = await fixture();
    const c = await store.create("alice", "A laptop");
    await store.update("alice", c.id, (draft) => {
      draft.messages.push({
        id: "m1",
        role: "user",
        text: "Laptop",
        createdAt: new Date().toISOString(),
      });
    });
    const reopened = await ConversationStore.open(path);
    expect(reopened.get("alice", c.id).messages).toHaveLength(1);
    expect(() => reopened.get("bob", c.id)).toThrow("not found");
    expect(reopened.list("bob").items).toEqual([]);
    const copy = reopened.get("alice", c.id);
    copy.messages.length = 0;
    expect(reopened.get("alice", c.id).messages).toHaveLength(1);
  });
  it("serializes concurrent writes without lost messages", async () => {
    const { store } = await fixture();
    const c = await store.create("alice");
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.update("alice", c.id, (d) => {
          d.messages.push({
            id: String(i),
            role: "user",
            text: String(i),
            createdAt: new Date().toISOString(),
          });
        }),
      ),
    );
    expect(store.get("alice", c.id).revision).toBe(25);
    const newest = store.messages("alice", c.id);
    expect(newest.items.map((m) => m.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(i + 5)),
    );
    const older = store.messages("alice", c.id, { before: newest.nextCursor });
    expect(older.items.map((m) => m.id)).toEqual(["0", "1", "2", "3", "4"]);
    expect(older.nextCursor).toBeUndefined();
  });
  it("marks an interrupted response as recoverable error on restart", async () => {
    const { store, path } = await fixture();
    const c = await store.create("alice");
    await store.update("alice", c.id, (d) => {
      d.messages.push({
        id: "m",
        role: "assistant",
        text: "Partial",
        status: "streaming",
        createdAt: new Date().toISOString(),
      });
    });
    const reopened = await ConversationStore.open(path);
    expect(reopened.get("alice", c.id).messages[0]).toMatchObject({
      text: "Partial",
      status: "error",
    });
    expect(reopened.get("alice", c.id).messages[0].error).toContain("restart");
  });
  it("refuses corrupted storage without overwriting it", async () => {
    const { path } = await fixture();
    await writeFile(path, "{broken");
    await expect(ConversationStore.open(path)).rejects.toMatchObject({
      code: "CORRUPT",
    });
    expect(await readFile(path, "utf8")).toBe("{broken");
  });
  it("does not publish an update when disk commit fails", async () => {
    const { store, path } = await fixture();
    const c = await store.create("alice");
    await rm(path);
    await mkdir(path); // Simulate an unwritable target deterministically, even when tests run as root.
    await expect(
      store.update("alice", c.id, (d) => {
        d.title = "Unsaved";
      }),
    ).rejects.toMatchObject({ code: "WRITE_FAILED" });
    expect(store.get("alice", c.id).title).toBe("New conversation");
    expect(store.get("alice", c.id).revision).toBe(0);
  });
  it("paginates history without leaking owners", async () => {
    const { store } = await fixture();
    for (let i = 0; i < 23; i++) await store.create("alice", `Chat ${i}`);
    await store.create("bob", "Private");
    const page = store.list("alice");
    const older = store.list("alice", { cursor: page.nextCursor });
    expect(page.items).toHaveLength(20);
    expect(older.items).toHaveLength(3);
    expect(new Set([...page.items, ...older.items].map((c) => c.id)).size).toBe(
      23,
    );
    expect(older.nextCursor).toBeUndefined();
  });
});
