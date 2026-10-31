import type { EvalCase } from "../support/types.js";
import { message } from "../support/fixtures.js";
export const cases: EvalCase[] = [
  {
    name: "baseline smartphone budget",
    input: "Find a smartphone under $500",
    expected:
      "Retrieve smartphones with the explicit $500 maximum, show only relevant grounded products, and respond briefly without listing card names or prices.",
    mustSearch: true,
  },
  {
    name: "baseline explicit multi intent",
    input:
      "Show me a smartphone under $500 and a fragrance under $50. I'd like options for both.",
    expected:
      "Address both explicit intents with separately retrieved relevant choices, preserve each budget, and make clear which categories are represented in one concise paragraph without duplicating card details. Explain any missing category honestly.",
    mustSearch: true,
  },
  {
    name: "broad shoes clarify first",
    input: "I'm looking for shoes",
    expected:
      "Ask one useful question about shoe type or intended use BEFORE search. No cards, product list, gender assumption or excessive questions.",
    noSearch: true,
  },
  {
    name: "vague request",
    input: "something cheap and cool",
    expected:
      "Ask one useful natural clarification about interests or product type. No cards.",
    noSearch: true,
  },
  {
    name: "recover from premature recommendations",
    input: "try again",
    history: [
      message("user", "I'm looking for shoes"),
      message(
        "assistant",
        "Here are ten shoe recommendations, with their names and prices. What type of shoes do you want?",
      ),
    ],
    expected:
      "Recognize the previous response jumped ahead. Ask one useful question about intended use or style. Do not repeat a product dump.",
    noSearch: true,
  },
  {
    name: "off catalog",
    input: "Book me a flight to Tokyo",
    expected:
      "Explain shopping catalog scope and do not claim to book flights.",
    noSearch: true,
  },
  {
    name: "specific shoe preferences",
    input: "Show me men's casual sneakers under $100",
    expected:
      "Search using men's shoes and explicit budget. Present only relevant retrieved items if available, otherwise honestly explain limitations. One short paragraph, no duplicate product-name/price list.",
    mustSearch: true,
  },
  {
    name: "size availability unsupported",
    input:
      "I'm interested in men's casual shoes under $100 in size42. Show me options.",
    expected:
      "Clearly say size availability cannot be checked in this catalog. May show matching style/budget products but must NOT claim available in size42. Brief text without duplicating card names/prices.",
    mustSearch: true,
  },
];
