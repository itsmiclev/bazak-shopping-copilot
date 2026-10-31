import { Inject, Injectable } from "@nestjs/common";
import type { RunAgent } from "@bazak/agent";
import {
  sameSearchIdentity,
  type Message,
  type SearchState,
} from "@bazak/shared";
import {
  CONVERSATION_REPOSITORY,
  type ConversationRepository,
} from "../domain/conversation.repository.js";
import {
  checkpointAssistant,
  failAssistant,
  type GenerationSnapshot,
} from "../domain/conversation.transitions.js";
import {
  GENERATION_STATE,
  CONVERSATION_EVENTS,
  type GenerationStatePort,
  type ConversationEventsPort,
} from "./generation-coordination.js";
import { SHOPPING_AGENT } from "./tokens.js";

@Injectable()
export class GenerationRunner {
  constructor(
    @Inject(CONVERSATION_REPOSITORY)
    private readonly repository: ConversationRepository,
    @Inject(SHOPPING_AGENT) private readonly agent: RunAgent,
    @Inject(GENERATION_STATE) private readonly state: GenerationStatePort,
    @Inject(CONVERSATION_EVENTS)
    private readonly events: ConversationEventsPort,
  ) {}
  /** Called after the input is durable; deliberately independent of the HTTP connection. */
  async run(
    owner: string,
    id: string,
    assistantId: string,
    context: Message[],
  ) {
    const snapshot: GenerationSnapshot = {
      text: "",
      products: [],
      searches: [],
    };
    let lastWrite = 0;
    const checkpoint = async (complete = false) => {
      await this.repository.update(owner, id, (c) =>
        checkpointAssistant(c, assistantId, snapshot, complete),
      );
      lastWrite = Date.now();
      this.events.notify(id);
    };
    try {
      await this.agent(context, {
        onText: async (text) => {
          snapshot.text += text;
          if (Date.now() - lastWrite > 120) await checkpoint();
        },
        onProducts: async (products) => {
          snapshot.products = [
            ...new Map(
              [...snapshot.products, ...products].map((product) => [
                product.id,
                product,
              ]),
            ).values(),
          ].slice(0, 24);
        },
        onSearch: async (search) =>
          this.upsertSearch(snapshot.searches, search),
      });
      if (!snapshot.text.trim())
        snapshot.text = snapshot.products.length
          ? "Here are the matching products from the catalog."
          : "I could not produce a response. Please try again.";
      await checkpoint(true);
    } catch (error) {
      await this.recordFailure(owner, id, assistantId, snapshot, error);
    } finally {
      this.state.release(id);
      this.events.notify(id);
    }
  }
  private upsertSearch(searches: SearchState[], search: SearchState) {
    const index = searches.findIndex((candidate) =>
      sameSearchIdentity(candidate, search),
    );
    if (index < 0) searches.push(search);
    else searches[index] = search;
  }
  private async recordFailure(
    owner: string,
    id: string,
    assistantId: string,
    snapshot: GenerationSnapshot,
    error: unknown,
  ) {
    const message =
      error instanceof Error && error.name === "RetrievalError"
        ? error.message
        : "The response could not be completed. Please try again.";
    try {
      await this.repository.update(owner, id, (c) =>
        failAssistant(c, assistantId, snapshot, message),
      );
    } catch {
      this.state.recordStorageFailure(id);
      console.error(
        "Failed to persist generation failure; check storage availability.",
      );
    }
  }
}
