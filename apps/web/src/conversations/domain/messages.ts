import type { Message, PollResponse } from "@bazak/shared";
export function mergeMessages(current: Message[], next: Message[]): Message[] {
  const map = new Map(current.map((message) => [message.id, message]));
  for (const message of next) map.set(message.id, message);
  return [...map.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}
/** A late history page or poll must never roll a streamed message backwards. */
export function mergeSnapshots(snapshots: readonly PollResponse[]): Message[] {
  return [...snapshots]
    .sort((a, b) => a.revision - b.revision)
    .reduce<Message[]>(
      (messages, snapshot) => mergeMessages(messages, snapshot.messages),
      [],
    );
}
export function newestSnapshot(
  snapshots: readonly (PollResponse | undefined)[],
): PollResponse | undefined {
  return snapshots
    .filter((s): s is PollResponse => Boolean(s))
    .reduce<PollResponse | undefined>(
      (latest, next) =>
        !latest || next.revision >= latest.revision ? next : latest,
      undefined,
    );
}
