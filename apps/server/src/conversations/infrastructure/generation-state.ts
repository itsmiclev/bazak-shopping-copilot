import { Injectable } from "@nestjs/common";
import { conversationStatus, type Conversation } from "@bazak/shared";
import { ConversationError } from "../domain/conversation.error.js";

/** Single-process admission and transient errors; durable messages remain in the repository. */
@Injectable()
export class GenerationState {
  private readonly active = new Set<string>();
  private readonly errors = new Map<string, string>();
  private readonly turns: number[] = [];
  isActive(id: string) {
    return this.active.has(id);
  }
  admit(conversation: Conversation) {
    if (
      this.isActive(conversation.id) ||
      conversationStatus(conversation) === "streaming"
    )
      throw new ConversationError("BUSY", "A response is already in progress.");
    const now = Date.now();
    while (this.turns.length && now - this.turns[0] > 60_000)
      this.turns.shift();
    if (this.turns.length >= 12 || this.active.size >= 3)
      throw new ConversationError(
        "RATE_LIMITED",
        "Too many requests. Please wait a moment.",
      );
    this.turns.push(now);
    this.active.add(conversation.id);
  }
  release(id: string) {
    this.active.delete(id);
  }
  clearFailure(id: string) {
    this.errors.delete(id);
  }
  recordStorageFailure(id: string) {
    this.errors.set(
      id,
      "The response could not be saved. Check disk space and permissions, then try again.",
    );
  }
  visible(conversation: Conversation) {
    const error = this.errors.get(conversation.id);
    const assistant = conversation.messages.at(-1);
    if (error && assistant?.role === "assistant") {
      assistant.status = "error";
      assistant.error = error;
    }
    return conversation;
  }
}
