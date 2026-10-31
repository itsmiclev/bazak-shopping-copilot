# Historical shoe recall audit and the generic retrieval design

This audit records an earlier iteration on 31 October 2026. The observed recall problem remains a regression case; the temporary shoe-specific implementation described below was subsequently replaced by generic attribute evidence matching.

## Findings in the earlier conversation

The opening clarification was appropriate: the assistant asked for shoe type and budget without presenting products.

After “sneakers up to 500$,” the two displayed listings were relevant and within budget, but recall was incomplete. The saved search used `q=sneakers`, which returned two lexical matches. The assistant incorrectly promoted that narrow result count into “the catalog only has a couple of matches.”

The category answer lost conversational context by listing the whole catalog instead of first explaining the two shoe categories. When challenged with “those are the only shoes?”, the assistant checked women's shoes but did not inspect the men's category for singular “sneaker” and “trainers.” It therefore did not resolve the user's concern.

## Catalog validation

The live keyword search returned two products. Both complete shoe categories returned five products each. Four listings have explicit sneaker/trainer evidence and cost at most $500:

| ID | Product | Price USD | Evidence |
| --- | --- | ---: | --- |
| 88 | Nike Air Jordan 1 Red And Black | 149.99 | Description identifies a basketball sneaker |
| 90 | Puma Future Rider Trainers | 89.99 | Trainers described for casual everyday wear |
| 91 | Sports Sneakers Off White & Red | 119.99 | Explicit sneaker listing |
| 92 | Sports Sneakers Off White Red | 109.99 | Explicit sneaker listing |

Nike Baseball Cleats (89) are a different footwear style. Pampi Shoes (188) are described as casual, but the data does not establish that they are sneakers. The other women's listings describe slippers, heels or general shoes. All four supported sneaker matches are catalogued as men's shoes; that is catalog metadata, not evidence of the user's gender or fit. Size availability is absent.

Sources inspected on 31 October 2026: [keyword search](https://dummyjson.com/products/search?q=sneakers&limit=100), [men's shoe category](https://dummyjson.com/products/category/mens-shoes?limit=100), [women's shoe category](https://dummyjson.com/products/category/womens-shoes?limit=100).

## What changed after the audit

The first correction introduced a footwear-specific style tool with a small synonym vocabulary. That recovered the singular “sneaker” and “trainers” cases, but embedded one product family in the architecture. It was an intermediate implementation, not the final design.

The current production agent uses generic `searchByAttributes` and `searchAcrossCategories`. The caller chooses one to three relevant categories and supplies positive aliases, any/all matching and optional exclusions. For this regression, sneaker/trainer aliases and incompatible footwear exclusions are fixture or model inputs; no production branch dispatches shoe categories or hardcodes those terms. The same mechanism is tested with materials, scents and other product evidence.

Every requested attribute, exact brand and numerical constraint intersects within each category. Generic category search returns scoped coverage and per-category cursors under the shared three-request budget. Negative-only filters are supported. Currency is explicit, with unsupported currency requests rejected before HTTP retrieval. Successful identical pages may be reused within a turn to prevent duplicate loops; this does not cache queries across turns.

This approach makes the code reusable without claiming semantic understanding. The model still selects categories and aliases, and the matcher checks explicit phrase evidence. Missing aliases, implicit properties and negated descriptions can cause errors. Candidate coverage and evidence quality matter more than the number of tool modules. The latest live results are scoped separately in the verification report; this historical audit is not a fresh proof of current end-to-end behavior.

## Decisions API experiment

The installed Vercel AI SDK supports OpenAI's Decisions API through `experimental_decide` and `decisionModel('gpt-6-luna')`. The [official guide](https://developers.openai.com/api/docs/guides/decisions) describes typed choices, predicates and rubric scores; application code executes the chosen action.

An exploratory local benchmark compared the same conversation and ten candidate products, asking for routing and relevance decisions. Both APIs identified the correct four products in all three trials.

| API | Trial times | Median |
| --- | --- | --- |
| Decisions | 877ms, 452ms, 238ms | 452ms |
| Responses with structured output | 2864ms, 3026ms, 2585ms | 2864ms |

This is about 6.3× faster for this small classification task, not a 6.3× end-to-end chat improvement. There are only three trials per API; request shapes differ, cache/warmup and network effects are not isolated, and retrieval plus final text generation are excluded. Quality was equal on this one example, so this does not establish better relevance generally. The experimental predicate threshold 0.5 is not calibrated. Token usage is retained in the JSON results; it does not establish comparative cost without applicable pricing.

Recommendation: fix candidate recall first (implemented), then consider Decisions as a replacement for a planning/ranking call. Good uses include clarify-versus-search routing, finite category or attribute classification, or relevance judgments on retrieved candidates. It cannot recover products absent from the candidate set and does not generate the natural chat answer. Exact arbitrary budget extraction still needs an appropriate extraction path; a fixed choice or rubric score is not an arbitrary numeric parser. Adding Decisions in front of the unchanged tool loop could make total latency worse. Keep it experimental until a representative multi-turn benchmark measures end-to-end latency, recall, and false-positive rates. It is not enabled in the production chat flow.
