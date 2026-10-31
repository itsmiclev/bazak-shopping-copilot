import { randomUUID } from "node:crypto";
import type {
  Conversation,
  Message,
  Product,
  SearchState,
} from "@bazak/shared";

export function appendTurn(
  conversation: Conversation,
  input: { text: string; requestId: string },
  assistantId: string,
) {
  if (!conversation.messages.length)
    conversation.title = input.text.slice(0, 70);
  for (const message of conversation.messages) {
    if (message.status === "pending" || message.status === "streaming") {
      message.status = "error";
      message.error = "Previous generation could not be saved.";
    }
  }
  const createdAt = new Date().toISOString();
  conversation.messages.push(
    {
      id: randomUUID(),
      role: "user",
      text: input.text,
      createdAt,
      status: "complete",
      requestId: input.requestId,
    },
    {
      id: assistantId,
      role: "assistant",
      text: "",
      createdAt,
      status: "pending",
    },
  );
}

export interface GenerationSnapshot {
  text: string;
  products: Product[];
  searches: SearchState[];
}
export function checkpointAssistant(
  conversation: Conversation,
  id: string,
  snapshot: GenerationSnapshot,
  complete: boolean,
) {
  const assistant = findAssistant(conversation, id);
  assistant.text = snapshot.text;
  assistant.products = complete ? snapshot.products : [];
  assistant.searches = snapshot.searches;
  assistant.status = complete ? "complete" : "streaming";
}
export function failAssistant(
  conversation: Conversation,
  id: string,
  snapshot: GenerationSnapshot,
  error: string,
) {
  const assistant = findAssistant(conversation, id);
  assistant.text = snapshot.text;
  assistant.products = [];
  assistant.searches = snapshot.searches;
  assistant.status = "error";
  assistant.error = error;
}
function findAssistant(conversation: Conversation, id: string): Message {
  const message = conversation.messages.find(
    (message) => message.id === id && message.role === "assistant",
  );
  if (!message)
    throw new Error("Assistant message is missing from its conversation.");
  return message;
}
