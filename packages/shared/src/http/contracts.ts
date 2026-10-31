import { z } from "zod";
import {
  MAX_MESSAGE_LENGTH,
  MessageSchema,
  ConversationSummarySchema,
} from "../conversations/conversation.js";

export const UuidSchema = z
  .string()
  .regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
export const SubmitMessageSchema = z.object({
  text: z.string().max(MAX_MESSAGE_LENGTH).trim().min(1),
  requestId: UuidSchema,
});
export type SubmitMessage = z.input<typeof SubmitMessageSchema>;
export const ConversationsResponseSchema = z.object({
  conversations: z.array(ConversationSummarySchema),
  nextCursor: z.string().optional(),
});
export type ConversationsResponse = z.input<typeof ConversationsResponseSchema>;
export const PollResponseSchema = z.object({
  messages: z.array(MessageSchema),
  revision: z.number().int().nonnegative(),
  status: z.enum(["streaming", "error", "complete"]),
});
export type PollResponse = z.input<typeof PollResponseSchema>;
export const MessagesResponseSchema = PollResponseSchema.extend({
  nextCursor: z.string().optional(),
});
export type MessagesResponse = z.input<typeof MessagesResponseSchema>;
export const SubmitMessageResponseSchema = z.object({
  conversationId: z.string(),
});
export type SubmitMessageResponse = z.input<typeof SubmitMessageResponseSchema>;
export const ApiErrorSchema = z.object({ error: z.string() });
export type ApiError = z.input<typeof ApiErrorSchema>;
