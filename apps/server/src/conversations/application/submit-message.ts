import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  SubmitMessage as SubmitMessageRequest,
  SubmitMessageResponse,
} from "@bazak/shared";
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from "../domain/conversation.repository.js";
import { appendTurn } from "../domain/conversation.transitions.js";
import { ConversationError } from "../domain/conversation.error.js";
import {
  GENERATION_STATE,
  CONVERSATION_EVENTS,
  type GenerationStatePort,
  type ConversationEventsPort,
} from "./generation-coordination.js";
import { GenerationRunner } from "./generation-runner.js";
import { SERVER_OPTIONS, type ServerOptions } from "./tokens.js";

@Injectable()
export class SubmitMessage {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly repository: ConversationRepository,
    @Inject(GENERATION_STATE) private readonly state: GenerationStatePort,
    @Inject(CONVERSATION_EVENTS)
    private readonly events: ConversationEventsPort,
    @Inject(GenerationRunner) private readonly runner: GenerationRunner,
    @Inject(SERVER_OPTIONS) private readonly options: ServerOptions,
  ) {}
  async execute(
    owner: string,
    id: string,
    input: SubmitMessageRequest,
  ): Promise<SubmitMessageResponse> {
    // Read after HTTP body validation so delayed requests cannot use stale idempotency state.
    const conversation = this.state.visible(this.repository.get(owner, id));
    if (
      conversation.messages.some(
        (message) => message.requestId === input.requestId,
      )
    )
      return { conversationId: id };
    if (this.options.available && !this.options.available())
      throw new ConversationError(
        "UNAVAILABLE",
        "Set OPENAI_API_KEY in the server .env file to start chatting.",
      );
    this.state.admit(conversation);
    const assistantId = randomUUID();
    try {
      const saved = await this.repository.update(owner, id, (c) =>
        appendTurn(c, input, assistantId),
      );
      this.state.clearFailure(id);
      this.events.notify(id);
      void this.runner.run(owner, id, assistantId, saved.messages.slice(0, -1));
      return { conversationId: id };
    } catch (error) {
      this.state.release(id);
      throw error;
    }
  }
}
