import { Module, type DynamicModule } from "@nestjs/common";
import type { ConversationStore } from "@bazak/storage";
import type { RunAgent } from "@bazak/agent";
import { CONVERSATION_REPOSITORY } from "./domain/conversation.repository.js";
import {
  SnapshotConversationRepository,
  SNAPSHOT_STORE,
} from "./infrastructure/snapshot-conversation.repository.js";
import { GenerationState } from "./infrastructure/generation-state.js";
import { ConversationEvents } from "./infrastructure/conversation-events.js";
import {
  GENERATION_STATE,
  CONVERSATION_EVENTS,
} from "./application/generation-coordination.js";
import { ConversationQueries } from "./application/conversation-queries.js";
import { SubmitMessage } from "./application/submit-message.js";
import { GenerationRunner } from "./application/generation-runner.js";
import {
  SHOPPING_AGENT,
  SERVER_OPTIONS,
  type ServerOptions,
} from "./application/tokens.js";
import { ConversationsController } from "./presentation/conversations.controller.js";
import { HealthController } from "./presentation/health.controller.js";

@Module({})
export class ConversationsModule {
  static register(
    store: ConversationStore,
    agent: RunAgent,
    options: ServerOptions,
  ): DynamicModule {
    return {
      module: ConversationsModule,
      controllers: [ConversationsController, HealthController],
      providers: [
        { provide: SNAPSHOT_STORE, useValue: store },
        { provide: SHOPPING_AGENT, useValue: agent },
        { provide: SERVER_OPTIONS, useValue: options },
        {
          provide: CONVERSATION_REPOSITORY,
          useClass: SnapshotConversationRepository,
        },
        { provide: GENERATION_STATE, useClass: GenerationState },
        { provide: CONVERSATION_EVENTS, useClass: ConversationEvents },
        ConversationQueries,
        SubmitMessage,
        GenerationRunner,
      ],
    };
  }
}
