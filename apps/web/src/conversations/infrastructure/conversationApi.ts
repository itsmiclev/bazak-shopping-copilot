import {
  ApiErrorSchema,
  ConversationsResponseSchema,
  MessagesResponseSchema,
  PollResponseSchema,
  SubmitMessageResponseSchema,
  ConversationViewSchema,
  SubmitMessageSchema,
  type SubmitMessage,
  type ConversationsResponse,
  type ConversationView,
  type MessagesResponse,
  type PollResponse,
  type SubmitMessageResponse,
} from "@bazak/shared";

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
async function request<T>(
  path: string,
  schema: { parse: (value: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(value);
    throw new HttpError(
      parsed.success
        ? parsed.data.error
        : `Request failed (${response.status}).`,
      response.status,
    );
  }
  try {
    return schema.parse(value);
  } catch {
    throw new Error(
      "The server returned an unexpected response. Please refresh and try again.",
    );
  }
}
export const conversationApi = {
  list: (
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<ConversationsResponse> =>
    request(
      `/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
      ConversationsResponseSchema,
      { signal },
    ),
  create: (): Promise<ConversationView> =>
    request("/conversations", ConversationViewSchema, {
      method: "POST",
      body: "{}",
    }),
  messages: (
    id: string,
    before?: string,
    signal?: AbortSignal,
  ): Promise<MessagesResponse> =>
    request(
      `/conversations/${encodeURIComponent(id)}/messages${before ? `?before=${encodeURIComponent(before)}` : ""}`,
      MessagesResponseSchema,
      { signal },
    ),
  poll: (
    id: string,
    revision: number,
    signal?: AbortSignal,
  ): Promise<PollResponse> =>
    request(
      `/conversations/${encodeURIComponent(id)}/poll?after=${revision}`,
      PollResponseSchema,
      { signal },
    ),
  submit: (id: string, input: SubmitMessage): Promise<SubmitMessageResponse> =>
    request(
      `/conversations/${encodeURIComponent(id)}/messages`,
      SubmitMessageResponseSchema,
      {
        method: "POST",
        body: JSON.stringify(SubmitMessageSchema.parse(input)),
      },
    ),
};
export type ConversationApi = typeof conversationApi;
