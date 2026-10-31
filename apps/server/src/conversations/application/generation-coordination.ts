import type { Conversation } from "@bazak/shared";

export const GENERATION_STATE = Symbol("GenerationState");
export interface GenerationStatePort {
  isActive(id: string): boolean;
  admit(conversation: Conversation): void;
  release(id: string): void;
  clearFailure(id: string): void;
  recordStorageFailure(id: string): void;
  visible(conversation: Conversation): Conversation;
}
export const CONVERSATION_EVENTS = Symbol("ConversationEvents");
export interface ConversationEventsPort {
  notify(id: string): void;
  wait(id: string, timeoutMs: number, signal: AbortSignal): Promise<void>;
}
