import { useMemo, useRef } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { conversationApi } from "../infrastructure/conversationApi";
import {
  clearPendingRequest,
  requestForRetry,
} from "../infrastructure/browserState";
import { mergeSnapshots, newestSnapshot } from "../domain/messages";
import {
  historyOptions,
  messagesOptions,
  pollingOptions,
  submitOptions,
} from "./conversationQueries";

export function useConversations(active: string | null) {
  const client = useQueryClient();
  const history = useInfiniteQuery(historyOptions());
  const pages = useInfiniteQuery({
    ...messagesOptions(active ?? ""),
    enabled: Boolean(active),
  });
  const live = useQuery(pollingOptions(client, active ?? ""));
  const create = useMutation({
    mutationFn: conversationApi.create,
    retry: false,
  });
  const submit = useMutation(submitOptions(client));
  const pending = useRef(
    new Map<string, { text: string; requestId: string }>(),
  );
  const messages = useMemo(
    () =>
      mergeSnapshots([
        ...(pages.data?.pages ?? []),
        ...(live.data ? [live.data] : []),
      ]),
    [pages.data, live.data],
  );
  const snapshot = newestSnapshot([...(pages.data?.pages ?? []), live.data]);
  async function send(id: string, text: string) {
    let request = pending.current.get(id);
    if (!request || request.text !== text) {
      request = requestForRetry(id, text);
      pending.current.set(id, request);
    }
    await submit.mutateAsync({ ...request, conversationId: id });
    pending.current.delete(id);
    clearPendingRequest(id);
  }
  return {
    history: [
      ...new Map(
        (history.data?.pages.flatMap((page) => page.conversations) ?? []).map(
          (conversation) => [conversation.id, conversation],
        ),
      ).values(),
    ],
    historyError: history.error?.message ?? "",
    hasMoreHistory: history.hasNextPage,
    loadHistory: () => history.refetch(),
    loadMoreHistory: () => {
      if (!history.isFetchingNextPage)
        return history.fetchNextPage({ cancelRefetch: false });
    },
    messages,
    loading: Boolean(active && pages.isPending),
    loadingOlder: pages.isFetchingNextPage,
    hasOlder: pages.hasNextPage,
    loadOlder: () => pages.fetchNextPage({ cancelRefetch: false }),
    busy: snapshot?.status === "streaming",
    sending: create.isPending || submit.isPending,
    error:
      pages.error?.message ||
      (live.error
        ? "Connection interrupted. Reconnecting to your response…"
        : ""),
    create: () => create.mutateAsync(),
    send,
  };
}
