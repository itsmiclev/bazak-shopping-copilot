import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InfiniteQueryObserver,
  MutationObserver,
  QueryClient,
  QueryObserver,
  type InfiniteData,
} from "@tanstack/react-query";
import type { Message, MessagesResponse, PollResponse } from "@bazak/shared";
import {
  acceptLatestPage,
  conversationKeys,
  messagesOptions,
  pollingOptions,
  submitOptions,
} from "./conversationQueries";
import { mergeSnapshots } from "../domain/messages";
import type { ConversationApi } from "../infrastructure/conversationApi";

const message = (id: string, text: string): Message => ({
  id,
  role: "assistant",
  text,
  createdAt: `2026-10-31T00:00:0${id}.000Z`,
  status: "complete",
});
const page = (
  revision: number,
  messages: Message[],
  status: PollResponse["status"] = "streaming",
  nextCursor?: string,
): MessagesResponse => ({ revision, messages, status, nextCursor });
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const api = {
    list: vi.fn(),
    create: vi.fn(),
    messages: vi.fn(),
    poll: vi.fn(),
    submit: vi.fn(),
  } as unknown as ConversationApi;
  return { client, api };
}
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("conversation QueryClient integration", () => {
  it("keeps older pages when streaming updates arrive, and resumes at the known revision", async () => {
    const { client, api } = setup();
    vi.mocked(api.messages)
      .mockResolvedValueOnce(
        page(2, [message("2", "partial")], "streaming", "older"),
      )
      .mockResolvedValueOnce(page(2, [message("1", "old")], "streaming"));
    const observer = new InfiniteQueryObserver(
      client,
      messagesOptions("a", api),
    );
    await observer.refetch();
    await observer.fetchNextPage();
    vi.mocked(api.poll).mockResolvedValue(
      page(3, [message("2", "finished")], "complete"),
    );
    const live = await client.fetchQuery(pollingOptions(client, "a", api));
    const pages = client.getQueryData<InfiniteData<MessagesResponse>>(
      conversationKeys.messages("a"),
    )!;
    expect(mergeSnapshots([...pages.pages, live]).map((m) => m.text)).toEqual([
      "old",
      "finished",
    ]);
    expect(api.messages).toHaveBeenNthCalledWith(
      2,
      "a",
      "older",
      expect.any(AbortSignal),
    );
    expect(api.poll).toHaveBeenCalledWith("a", 2, expect.any(AbortSignal));
  });
  it("rejects a late poll that would roll back a newer response", async () => {
    const { client, api } = setup();
    acceptLatestPage(client, "a", page(1, [message("1", "start")]));
    let resolve!: (value: PollResponse) => void;
    vi.mocked(api.poll).mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const request = client.fetchQuery(pollingOptions(client, "a", api));
    client.setQueryData(
      conversationKeys.live("a"),
      page(4, [message("1", "newest")], "complete"),
    );
    resolve(page(2, [message("1", "stale")]));
    expect((await request).messages[0].text).toBe("newest");
  });
  it("isolates conversation caches while retaining loaded messages on a later send", () => {
    const { client } = setup();
    acceptLatestPage(client, "a", page(1, [message("1", "A")]));
    acceptLatestPage(client, "b", page(1, [message("2", "B")]));
    acceptLatestPage(client, "a", page(2, [message("3", "new A")]));
    expect(
      client
        .getQueryData<InfiniteData<MessagesResponse>>(
          conversationKeys.messages("a"),
        )
        ?.pages[0].messages.map((m) => m.text),
    ).toEqual(["A", "new A"]);
    expect(
      client.getQueryData<InfiniteData<MessagesResponse>>(
        conversationKeys.messages("b"),
      )?.pages[0].messages[0].text,
    ).toBe("B");
  });
  it("cancels the in-flight long poll when its observer leaves", async () => {
    const { client, api } = setup();
    acceptLatestPage(client, "a", page(1, [message("1", "start")]));
    let signal: AbortSignal | undefined;
    vi.mocked(api.poll).mockImplementation((_id, _revision, s) => {
      signal = s;
      return new Promise((_resolve, reject) =>
        s?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        ),
      );
    });
    const observer = new QueryObserver(
      client,
      pollingOptions(client, "a", api),
    );
    const unsubscribe = observer.subscribe(() => {});
    expect(signal?.aborted).toBe(false);
    unsubscribe();
    expect(signal?.aborted).toBe(true);
  });
  it("retries an uncertain submission with the exact same idempotency key", async () => {
    const { client, api } = setup();
    vi.mocked(api.submit)
      .mockRejectedValueOnce(new TypeError("Network interrupted"))
      .mockResolvedValueOnce({ conversationId: "a" });
    vi.mocked(api.messages).mockResolvedValue(
      page(2, [message("1", "answer")], "complete"),
    );
    const observer = new MutationObserver(client, {
      ...submitOptions(client, api),
      retryDelay: 0,
    });
    const input = {
      conversationId: "a",
      text: "desk lamp",
      requestId: "11111111-1111-4111-8111-111111111111",
    };
    await observer.mutate(input);
    expect(api.submit).toHaveBeenCalledTimes(2);
    expect(api.submit).toHaveBeenNthCalledWith(1, "a", input);
    expect(api.submit).toHaveBeenNthCalledWith(2, "a", input);
    expect(
      client.getQueryData<InfiniteData<MessagesResponse>>(
        conversationKeys.messages("a"),
      )?.pages[0].revision,
    ).toBe(2);
  });
});
