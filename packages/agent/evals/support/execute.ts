import { sameSearchIdentity } from "@bazak/shared";
import { runAgent } from "../../src/index.js";
import { message } from "./fixtures.js";
import { evaluateAssertions } from "./assertions.js";
import { judgeObservation } from "./judge.js";
import type { EvalCase, EvalResult, Observation } from "./types.js";
export async function executeCase(test: EvalCase): Promise<EvalResult> {
  const observed: Observation = {
    text: "",
    products: [],
    candidates: [],
    searches: [],
    calls: [],
    retrievalResults: [],
  };
  const history = [...(test.history ?? []), message("user", test.input)];
  await runAgent(history, {
    onText: async (text) => {
      observed.text += text;
    },
    onProducts: async (products) => {
      observed.products = products;
    },
    onCandidates: async (products) => {
      observed.candidates.push(...products);
    },
    onSearch: async (state) => {
      const index = observed.searches.findIndex((saved) =>
        sameSearchIdentity(saved, state),
      );
      if (index < 0) observed.searches.push(state);
      else observed.searches[index] = state;
    },
    onRetrievalResult: async (result) => {
      observed.retrievalResults.push(result);
    },
    onToolCall: (name, args) => {
      observed.calls.push({ name, args });
    },
  });
  const assertions = evaluateAssertions(test, observed);
  const evidence = {
    name: test.name,
    input: test.input,
    criterion: test.expected,
    response: observed.text,
    productIds: observed.products.map((p) => p.id),
    retrievedCandidates: observed.candidates,
    searches: observed.searches,
    calls: observed.calls,
    retrievalResults: observed.retrievalResults,
    assertions,
  };
  console.log(JSON.stringify({ event: "observation", ...evidence }));
  const { judge, judgeAttempts } = await judgeObservation(test, observed);
  if (!judge)
    assertions.push(
      "Judge unavailable after two attempts; evaluation fails closed.",
    );
  const passed = judge?.pass === true && assertions.length === 0;
  console.log(
    JSON.stringify({
      ...evidence,
      judge: judge ?? null,
      judgeAttempts,
      pass: passed,
    }),
  );
  return {
    ...observed,
    passed,
    history: [
      ...history,
      {
        ...message("assistant", observed.text),
        products: observed.products,
        searches: observed.searches,
      },
    ],
  };
}
