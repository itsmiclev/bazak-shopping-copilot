import { SubmitMessageSchema } from "@bazak/shared";
export function storedConversation(): string | null {
  try {
    return localStorage.getItem("finds.conversation");
  } catch {
    return null;
  }
}
export function saveConversation(id: string | null) {
  try {
    if (id) localStorage.setItem("finds.conversation", id);
    else localStorage.removeItem("finds.conversation");
  } catch {
    /* Server history still works without browser storage. */
  }
}
export function requestForRetry(conversationId: string, text: string) {
  const key = `finds.pending.${conversationId}`;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    const parsed = SubmitMessageSchema.safeParse(saved);
    if (parsed.success && parsed.data.text === text) return parsed.data;
  } catch {
    /* Fall back to a fresh request when storage is unavailable. */
  }
  const request = { text, requestId: crypto.randomUUID() };
  try {
    sessionStorage.setItem(key, JSON.stringify(request));
  } catch {}
  return request;
}
export function clearPendingRequest(conversationId: string) {
  try {
    sessionStorage.removeItem(`finds.pending.${conversationId}`);
  } catch {}
}
