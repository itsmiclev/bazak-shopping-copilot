import type { ExecuteCase, Observation } from "../support/types.js";
import { message } from "../support/fixtures.js";

const retrievalCalls = (observed: Observation) =>
  observed.calls.filter((call) =>
    [
      "searchProducts",
      "browseCategory",
      "searchByAttributes",
      "searchByBrand",
      "searchByPrice",
    ].includes(call.name),
  );
function withoutOldMinimum(observed: Observation) {
  return retrievalCalls(observed).some(
    (call) => (call.args as { minPrice?: number }).minPrice === 150,
  )
    ? ["Search reinstated the superseded $150 minimum."]
    : [];
}
function withinCeiling(observed: Observation, ceiling: number) {
  return observed.products.some((product) => product.price > ceiling)
    ? ["Displayed product exceeds the active price ceiling."]
    : [];
}

export async function naturalBudgetScenario(execute: ExecuteCase) {
  const strict = await execute({
    name: "natural-budget explicit lower and upper bounds",
    input: "I’m looking for trainers, but only in the $150–$200 range.",
    expected:
      "Search the requested footwear using both explicit USD price bounds. Do not present cheaper alternatives as matches or ask unnecessary questions. If none match, explain the scoped result and offer a sensible alternative.",
    mustSearch: true,
    check: (observed) => [
      ...(observed.products.some(
        (product) => product.price < 150 || product.price > 200,
      )
        ? ["Product violates the initial explicit range."]
        : []),
      ...(retrievalCalls(observed).some((call) => {
        const args = call.args as { minPrice?: number; maxPrice?: number };
        return args.minPrice !== 150 || args.maxPrice !== 200;
      })
        ? ["Initial search silently relaxed an explicit price bound."]
        : []),
    ],
  });
  const priceOptions = await execute({
    name: "natural-budget explore cheaper alternatives",
    input: "What would the less expensive choices cost?",
    history: strict.history,
    expected:
      "Inspect less expensive alternatives because the user explicitly asked about them, then describe their prices from evidence without claiming they satisfy the original minimum. Treat this as price exploration, not permission to reinstate or fabricate a range.",
    mustSearch: true,
    check: (observed) => [
      ...withoutOldMinimum(observed),
      ...(observed.products.length
        ? [
            "Do not present below-budget alternatives before the user accepts them.",
          ]
        : []),
    ],
  });
  const accepted = await execute({
    name: "natural-budget accepted alternatives",
    input: "Those sound good—show me some.",
    history: priceOptions.history,
    expected:
      "Interpret this as accepting the cheaper alternatives just discussed. Show relevant products from that revised scope without restoring the original $150 floor. Do not add an unprompted shoe-size disclaimer or mandatory closing question.",
    mustSearch: true,
    check: (observed) => [
      ...withoutOldMinimum(observed),
      ...withinCeiling(observed, 200),
      ...(!observed.products.length
        ? ["Accepted alternatives were not presented."]
        : []),
    ],
  });
  await execute({
    name: "natural-budget change use after acceptance",
    input: "How about something for casual everyday wear instead?",
    history: accepted.history,
    expected:
      "Change the footwear preference to casual everyday use while retaining the accepted cheaper scope, not the obsolete $150 minimum. Select products supported by their descriptions; do not equate every athletic product with casual everyday footwear. Help directly or ask once only if genuinely necessary.",
    mustSearch: true,
    check: (observed) => [
      ...withoutOldMinimum(observed),
      ...withinCeiling(observed, 200),
      ...(!observed.products.length
        ? ["No relevant casual alternative was presented."]
        : []),
    ],
  });
}

export async function naturalDiscoveryScenario(execute: ExecuteCase) {
  const skinCare = await execute({
    name: "natural-discovery personal care beyond makeup",
    input: "Can you suggest skin-care products for men, rather than makeup?",
    history: [
      message("user", "Let’s explore beauty."),
      message(
        "assistant",
        "I can help you explore the makeup and personal-care categories.",
      ),
    ],
    expected:
      "Help with relevant skincare options, including broadly suitable products when no gender-specific label exists. Do not merely explain that makeup has no male label, invent gender claims, stereotype preferences, or block useful results with a questionnaire.",
    mustSearch: true,
    check: (observed) =>
      !observed.products.length
        ? ["Explicit skincare discovery produced no product options."]
        : [],
  });
  await execute({
    name: "natural-discovery contextual fragrance request",
    input: "And something that smells nice?",
    history: skinCare.history,
    expected:
      "Use the personal-care context to explore relevant fragrance or scented-care choices without asking the user to start over. Ground scent and suitability claims in product evidence and do not invent gender labels.",
    mustSearch: true,
    check: (observed) =>
      !observed.products.length
        ? ["Contextual fragrance discovery produced no product options."]
        : [],
  });
}

export async function naturalCurrencyScenario(execute: ExecuteCase) {
  const clarification = await execute({
    name: "natural-currency unsupported budget",
    input: "Find a fragrance under 100 shekels.",
    expected:
      "Recognize the ILS budget while the catalog is USD. Ask for a USD budget or permission to browse without price filtering. Do not silently interpret100 as USD, invent a conversion, or show USD products as within the ILS budget.",
    check: (observed) => [
      ...(observed.products.length
        ? ["Displayed products against an unconverted currency budget."]
        : []),
      ...(retrievalCalls(observed).some((call) => {
        const args = call.args as { currency?: string; maxPrice?: number };
        return (
          args.maxPrice === 100 && (!args.currency || args.currency === "USD")
        );
      })
        ? ["Silently changed a shekel budget to USD."]
        : []),
    ],
  });
  await execute({
    name: "natural-currency explicit USD correction",
    input: "Use US dollars, up to80.",
    history: clarification.history,
    expected:
      "Apply the corrected USD80 ceiling and show relevant fragrance results. Do not keep asking about currency after the user resolved it.",
    mustSearch: true,
    check: (observed) => [
      ...withinCeiling(observed, 80),
      ...(!observed.products.length
        ? ["Corrected affordable fragrance request yielded no options."]
        : []),
    ],
  });
}

export async function naturalStockScenario(execute: ExecuteCase) {
  await execute({
    name: "natural-stock verify existence before availability claims",
    input: "Do you actually have boots or sandals in this catalog?",
    expected:
      "Check catalog evidence before claiming either product type exists. Distinguish searchable descriptions from verified available product types. No matches or incomplete coverage should be described honestly; do not answer with a generic list of supported styles as if it were inventory.",
    mustSearch: true,
  });
}
