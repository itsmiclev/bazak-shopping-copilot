import { Inject, Injectable } from "@nestjs/common";
import { ConversationStore } from "@bazak/storage";
import type { Conversation } from "@bazak/shared";
import type { ConversationRepository } from "../domain/conversation.repository.js";
export const SNAPSHOT_STORE = Symbol("SnapshotStore");
@Injectable()
export class SnapshotConversationRepository implements ConversationRepository {
  constructor(
    @Inject(SNAPSHOT_STORE) private readonly store: ConversationStore,
  ) {}
  get(owner: string, id: string) {
    return this.store.get(owner, id);
  }
  list(owner: string, options?: { cursor?: string; limit?: number }) {
    return this.store.list(owner, options);
  }
  messages(
    owner: string,
    id: string,
    options?: { before?: string; limit?: number },
  ) {
    return this.store.messages(owner, id, options);
  }
  create(owner: string, title?: string) {
    return this.store.create(owner, title);
  }
  update(owner: string, id: string, mutate: (draft: Conversation) => void) {
    return this.store.update(owner, id, mutate);
  }
}
