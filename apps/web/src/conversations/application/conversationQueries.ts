import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type {
  MessagesResponse,
  PollResponse,
  SubmitMessage,
} from "@bazak/shared";
import {
  conversationApi,
  HttpError,
  type ConversationApi,
} from "../infrastructure/conversationApi";
import { mergeMessages, newestSnapshot } from "../domain/messages";
export const conversationKeys = {
  history: ["conversations"] as const,
  messages: (id: string) => ["conversation", id, "messages"] as const,
  live: (id: string) => ["conversation", id, "live"] as const,
};
export function historyOptions(api: ConversationApi = conversationApi) {
  return infiniteQueryOptions({
    queryKey: conversationKeys.history,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.list(pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 15_000,
  });
}
export function messagesOptions(
  id: string,
  api: ConversationApi = conversationApi,
) {
  return infiniteQueryOptions({
    queryKey: conversationKeys.messages(id),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => api.messages(id, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 0,
  });
}
export function cachedSnapshot(client: QueryClient, id: string) {
  return newestSnapshot([
    ...(client.getQueryData<InfiniteData<MessagesResponse>>(
      conversationKeys.messages(id),
    )?.pages ?? []),
    client.getQueryData<PollResponse>(conversationKeys.live(id)),
  ]);
}
export function pollingOptions(
  client: QueryClient,
  id: string,
  api: ConversationApi = conversationApi,
) {
  return queryOptions({
    queryKey: conversationKeys.live(id),
    queryFn: async ({ signal }) => {
      const after = cachedSnapshot(client, id)?.revision ?? 0;
      const response = await api.poll(id, after, signal);
      const current = cachedSnapshot(client, id);
      if (current && current.revision > response.revision) return current;
      if (response.status !== "streaming")
        void client.invalidateQueries({ queryKey: conversationKeys.history });
      return response;
    },
    enabled: () =>
      Boolean(id && cachedSnapshot(client, id)?.status === "streaming"),
    refetchInterval: () =>
      cachedSnapshot(client, id)?.status === "streaming" ? 150 : false,
    refetchIntervalInBackground: true,
    retry: 2,
    retryDelay: 2000,
    staleTime: 0,
  });
}
export function acceptLatestPage(
  client: QueryClient,
  id: string,
  page: MessagesResponse,
) {
  client.setQueryData<InfiniteData<MessagesResponse>>(
    conversationKeys.messages(id),
    (current) => {
      if (!current) return { pages: [page], pageParams: [undefined] };
      const first = current.pages[0];
      if (first && first.revision > page.revision) return current;
      return {
        ...current,
        pages: [
          {
            ...page,
            messages: mergeMessages(first?.messages ?? [], page.messages),
            nextCursor: first?.nextCursor ?? page.nextCursor,
          },
          ...current.pages.slice(1),
        ],
      };
    },
  );
}
export function submitOptions(
  client: QueryClient,
  api: ConversationApi = conversationApi,
) {
  return {
    mutationKey: ["send-message"],
    mutationFn: async (input: SubmitMessage & { conversationId: string }) => {
      await api.submit(input.conversationId, input);
      await client.cancelQueries({
        queryKey: conversationKeys.messages(input.conversationId),
      });
      const page = await api.messages(input.conversationId);
      acceptLatestPage(client, input.conversationId, page);
      void client.invalidateQueries({ queryKey: conversationKeys.history });
      return page;
    },
    retry: (count: number, error: Error) =>
      count < 1 && (!(error instanceof HttpError) || error.status >= 500),
    retryDelay: 500,
  };
}
