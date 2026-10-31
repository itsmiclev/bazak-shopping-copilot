import { z } from "zod";
import { ConversationSchema } from "@bazak/shared";

export const SnapshotSchema = z.object({
  version: z.literal(1),
  conversations: z
    .array(ConversationSchema)
    .refine(
      (conversations) =>
        new Set(conversations.map((conversation) => conversation.id)).size ===
        conversations.length,
      "Duplicate conversation ID",
    ),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;
