import { z } from "zod";
import { ProductSchema } from "../catalog/product.js";
import { SearchStateSchema } from "../catalog/search-state.js";

export const MESSAGE_PAGE_SIZE = 20;
export const MAX_MESSAGE_LENGTH = 4000;
export const DateStringSchema = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid date");
export const MessageStatusSchema = z.enum([
  "pending",
  "streaming",
  "complete",
  "error",
]);
export type MessageStatus = z.input<typeof MessageStatusSchema>;
export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  requestId: z.string().optional(),
  text: z.string(),
  products: z.array(ProductSchema).optional(),
  searches: z.array(SearchStateSchema).optional(),
  createdAt: DateStringSchema,
  status: MessageStatusSchema.optional(),
  error: z.string().optional(),
});
export type Message = z.input<typeof MessageSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  title: z.string(),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
  messages: z
    .array(MessageSchema)
    .refine(
      (messages) =>
        new Set(messages.map((message) => message.id)).size === messages.length,
      "Duplicate message ID",
    ),
  revision: z.number().int().nonnegative(),
});
export type Conversation = z.input<typeof ConversationSchema>;
export const ConversationSummarySchema = ConversationSchema.omit({
  messages: true,
  ownerId: true,
});
export type ConversationSummary = z.input<typeof ConversationSummarySchema>;
export const ConversationViewSchema = ConversationSchema.omit({
  ownerId: true,
});
export type ConversationView = z.input<typeof ConversationViewSchema>;
export type ConversationStatus = "streaming" | "error" | "complete";

export function conversationStatus(
  conversation: Pick<Conversation, "messages">,
): ConversationStatus {
  const status = conversation.messages.at(-1)?.status;
  if (status === "pending" || status === "streaming") return "streaming";
  return status === "error" ? "error" : "complete";
}

export interface Page<T> {
  items: T[];
  nextCursor?: string;
}
export interface MessagePage extends Page<Message> {
  revision: number;
}
