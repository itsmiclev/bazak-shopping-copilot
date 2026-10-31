import { Inject, Injectable } from "@nestjs/common";
import {
  conversationStatus,
  MESSAGE_PAGE_SIZE,
  type ConversationsResponse,
  type MessagesResponse,
  type PollResponse,
  type ConversationView,
} from "@bazak/shared";
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from "../domain/conversation.repository.js";
import {
  GENERATION_STATE,
  CONVERSATION_EVENTS,
  type GenerationStatePort,
  type ConversationEventsPort,
} from "./generation-coordination.js";
import { SERVER_OPTIONS, type ServerOptions } from "./tokens.js";

@Injectable()
export class ConversationQueries {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly repository: ConversationRepository,
    @Inject(GENERATION_STATE) private readonly state: GenerationStatePort,
    @Inject(CONVERSATION_EVENTS)
    private readonly events: ConversationEventsPort,
    @Inject(SERVER_OPTIONS) private readonly options: ServerOptions,
  ) {}
  list(owner: string, cursor?: string): ConversationsResponse {
    const page = this.repository.list(owner, { cursor });
    return { conversations: page.items, nextCursor: page.nextCursor };
  }
  async create(owner: string): Promise<ConversationView> {
    const { ownerId: _owner, ...conversation } =
      await this.repository.create(owner);
    return conversation;
  }
  messages(owner: string, id: string, before?: string): MessagesResponse {
    const conversation = this.state.visible(this.repository.get(owner, id));
    const page = this.repository.messages(owner, id, { before });
    const visibleMessages = new Map(
      conversation.messages.map((message) => [message.id, message]),
    );
    return {
      messages: page.items.map(
        (message) => visibleMessages.get(message.id) ?? message,
      ),
      nextCursor: page.nextCursor,
      revision: page.revision,
      status: conversationStatus(conversation),
    };
  }
  async poll(
    owner: string,
    id: string,
    after: number,
    signal: AbortSignal,
  ): Promise<PollResponse> {
    let conversation = this.state.visible(this.repository.get(owner, id));
    if (conversation.revision <= after && this.state.isActive(id)) {
      await this.events.wait(id, this.options.pollMs ?? 20_000, signal);
      conversation = this.state.visible(this.repository.get(owner, id));
    }
    return {
      messages: conversation.messages.slice(-MESSAGE_PAGE_SIZE),
      revision: conversation.revision,
      status: conversationStatus(conversation),
    };
  }
}
