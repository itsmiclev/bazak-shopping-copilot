export type ConversationErrorCode = "BUSY" | "RATE_LIMITED" | "UNAVAILABLE";
export class ConversationError extends Error {
  constructor(
    public readonly code: ConversationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ConversationError";
  }
}
