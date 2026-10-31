import { randomUUID } from "node:crypto";
import {
  MESSAGE_PAGE_SIZE,
  type Conversation,
  type ConversationSummary,
  type MessagePage,
  type Page,
} from "@bazak/shared";
import { StorageError } from "../domain/storage-error.js";
import { SnapshotSchema } from "../domain/snapshot.js";
import { SnapshotFile } from "./snapshot-file.js";

function validDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function pageSize(limit?: number) {
  return Math.min(
    MESSAGE_PAGE_SIZE,
    Math.max(
      1,
      Number.isFinite(limit) ? Math.floor(limit!) : MESSAGE_PAGE_SIZE,
    ),
  );
}

export class ConversationStore {
  private records = new Map<string, Conversation>();
  private writes: Promise<unknown> = Promise.resolve();
  private readonly snapshot: SnapshotFile;
  private constructor(public readonly path: string) {
    this.snapshot = new SnapshotFile(path);
  }

  static async open(path: string): Promise<ConversationStore> {
    const store = new ConversationStore(path);
    const parsed = await store.snapshot.read();
    if (!parsed) return store;
    let recovered = false;
    for (const conversation of parsed.conversations) {
      for (const message of conversation.messages) {
        if (message.status === "pending" || message.status === "streaming") {
          message.status = "error";
          message.error =
            "Generation was interrupted by a server restart. Please send your request again.";
          conversation.revision += 1;
          recovered = true;
        }
      }
      store.records.set(conversation.id, conversation);
    }
    if (recovered) await store.snapshot.write(store.records);
    return store;
  }

  get(ownerId: string, id: string): Conversation {
    const conversation = this.records.get(id);
    if (!conversation || conversation.ownerId !== ownerId)
      throw new StorageError("Conversation not found.", "NOT_FOUND");
    return structuredClone(conversation);
  }

  list(
    ownerId: string,
    { cursor, limit }: { cursor?: string; limit?: number } = {},
  ): Page<ConversationSummary> {
    let conversations = [...this.records.values()]
      .filter((c) => c.ownerId === ownerId)
      .sort(
        (a, b) =>
          b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
      );
    if (cursor) {
      let position: { time: string; id: string };
      try {
        position = JSON.parse(Buffer.from(cursor, "base64url").toString());
      } catch {
        throw new StorageError("Invalid history cursor.", "INVALID_CURSOR");
      }
      if (!validDate(position?.time) || typeof position?.id !== "string")
        throw new StorageError("Invalid history cursor.", "INVALID_CURSOR");
      conversations = conversations.filter(
        (c) =>
          c.updatedAt < position.time ||
          (c.updatedAt === position.time && c.id < position.id),
      );
    }
    const chosen = conversations.slice(0, pageSize(limit));
    const last = chosen.at(-1);
    return {
      items: chosen.map(
        ({ messages: _messages, ownerId: _owner, ...summary }) =>
          structuredClone(summary),
      ),
      ...(conversations.length > chosen.length && last
        ? {
            nextCursor: Buffer.from(
              JSON.stringify({ time: last.updatedAt, id: last.id }),
            ).toString("base64url"),
          }
        : {}),
    };
  }

  messages(
    ownerId: string,
    id: string,
    { before, limit }: { before?: string; limit?: number } = {},
  ): MessagePage {
    const conversation = this.get(ownerId, id);
    const end = before
      ? conversation.messages.findIndex((m) => m.id === before)
      : conversation.messages.length;
    if (end < 0)
      throw new StorageError("Invalid message cursor.", "INVALID_CURSOR");
    const start = Math.max(0, end - pageSize(limit));
    return {
      items: conversation.messages.slice(start, end),
      revision: conversation.revision,
      ...(start > 0 ? { nextCursor: conversation.messages[start].id } : {}),
    };
  }

  async create(
    ownerId: string,
    title = "New conversation",
  ): Promise<Conversation> {
    return this.enqueue(async () => {
      const now = new Date().toISOString();
      const conversation: Conversation = {
        id: randomUUID(),
        ownerId,
        title: title.slice(0, 100),
        createdAt: now,
        updatedAt: now,
        messages: [],
        revision: 0,
      };
      const next = new Map(this.records);
      next.set(conversation.id, conversation);
      await this.snapshot.write(next);
      this.records = next;
      return structuredClone(conversation);
    });
  }

  async update(
    ownerId: string,
    id: string,
    mutate: (draft: Conversation) => void,
  ): Promise<Conversation> {
    return this.enqueue(async () => {
      const draft = this.get(ownerId, id);
      mutate(draft);
      draft.id = id;
      draft.ownerId = ownerId;
      draft.revision = this.records.get(id)!.revision + 1;
      draft.updatedAt = new Date().toISOString();
      if (
        !SnapshotSchema.safeParse({ version: 1, conversations: [draft] })
          .success
      )
        throw new StorageError("Invalid conversation update.", "WRITE_FAILED");
      const next = new Map(this.records);
      next.set(id, draft);
      await this.snapshot.write(next);
      this.records = next;
      return structuredClone(draft);
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writes.then(operation);
    this.writes = result.catch(() => undefined);
    return result;
  }
}
