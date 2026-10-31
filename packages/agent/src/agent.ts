import { streamText, isStepCount } from "ai";
import type { RunAgent } from "./application/contracts.js";
import { contextMessages } from "./application/context.js";
import { createProductSelection } from "./application/selection.js";
import { createSearchSession } from "./application/search-session.js";
import { createSearch } from "./application/search.js";
import { model } from "./infrastructure/openai/model.js";
import { createShoppingTools } from "./tools/index.js";
import { SYSTEM } from "./prompt.js";
export const runAgent: RunAgent = async (messages, callbacks) => {
  const selection = createProductSelection();
  const session = createSearchSession(messages, createSearch(), {
    onSearch: callbacks.onSearch,
    onResult: callbacks.onRetrievalResult,
    onCandidates: async (products) => {
      selection.add(products);
      await callbacks.onCandidates?.(products);
    },
  });
  const result = streamText({
    model: model(),
    instructions: SYSTEM,
    messages: contextMessages(messages),
    stopWhen: isStepCount(6),
    maxOutputTokens: 1600,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(90_000),
    tools: createShoppingTools({ session, selection, callbacks }),
  });
  for await (const part of result.stream) {
    if (part.type === "text-delta") await callbacks.onText(part.text);
    if (part.type === "error") throw part.error;
  }
};
