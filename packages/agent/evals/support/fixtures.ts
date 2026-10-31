import type { Message } from "@bazak/shared";
export const message = (role: "user" | "assistant", text: string): Message => ({
  id: crypto.randomUUID(),
  role,
  text,
  createdAt: new Date().toISOString(),
});
