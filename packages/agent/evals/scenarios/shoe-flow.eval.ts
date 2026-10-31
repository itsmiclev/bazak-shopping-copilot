import type { ExecuteCase } from "../support/types.js";
export async function shoeFlowScenario(execute: ExecuteCase) {
  const opening = await execute({
    name: "shoe-flow broad request",
    input: "i want new shoes",
    expected:
      "Ask one useful short question about the kind of shoes or intended use before retrieval. Do not assume gender.",
    noSearch: true,
  });
  const sneakers = await execute({
    name: "shoe-flow sneaker recall",
    input: "sneakers up to500$",
    history: opening.history,
    expected:
      "Use prior shoe context and search sneaker style across BOTH shoe categories without assuming gender. Retrieve the relevant audited sneaker/trainer matches88,90,91,92 under500, excluding baseball cleats89, then select a relevant shortlist. One brief paragraph, not a card-content list. Do not claim these are the entire shoe catalog.",
    mustSearch: true,
    requiredSearchCategories: ["mens-shoes", "womens-shoes"],
    expectedCandidateIds: [88, 90, 91, 92],
    check: ({ products }) =>
      products.some((product) => product.id === 89)
        ? ["Baseball cleats are not sneakers."]
        : [],
  });
  const categories = await execute({
    name: "shoe-flow category context",
    input: "what categories are available?",
    history: sneakers.history,
    expected:
      "Retain the shoe-shopping context. Explain men's/women's shoe categories and relevant shoe styles, without dumping unrelated product categories. Be precise about which style availability is verified versus a supported filter. No unnecessary repeated product cards.",
  });
  await execute({
    name: "shoe-flow scope followup",
    input: "those are only shoes?",
    history: categories.history,
    expected:
      "Distinguish the shown sneaker-style matches under the user's budget from all shoes. Do not falsely claim the full shoe catalog contains only those four. Keep the response about shoes and styles, not a dump of unrelated categories. Avoid repeating the same cards unless explicitly requested.",
  });
}
