import type {
  Conversation,
  ConversationSummary,
  MessagePage,
  Page,
} from "@bazak/shared";

export const CONVERSATION_REPOSITORY = Symbol("ConversationRepository");
/** Application storage boundary. Returned conversations are detached snapshots. */
export interface ConversationRepository {
  get(ownerId: string, id: string): Conversation;
  list(
    ownerId: string,
    options?: { cursor?: string; limit?: number },
  ): Page<ConversationSummary>;
  messages(
    ownerId: string,
    id: string,
    options?: { before?: string; limit?: number },
  ): MessagePage;
  create(ownerId: string, title?: string): Promise<Conversation>;
  update(
    ownerId: string,
    id: string,
    mutate: (draft: Conversation) => void,
  ): Promise<Conversation>;
}
