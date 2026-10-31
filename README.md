# finds — Bazak shopping copilot

A local conversational product discovery app using the DummyJSON catalog and only `gpt-6-luna`. Search starts on a minimal landing page, then moves into a chat with product cards. Conversations survive refreshes, browser closure, and normal server restarts.

## Run locally

Requires Node.js 22.12+ and npm. From the repository root:

```sh
npm ci
cp .env.example .env
# Set OPENAI_API_KEY in .env to the assignment key.
npm run dev
```

Open http://127.0.0.1:5173. The API runs on 127.0.0.1:3101; the frontend proxies `/api`. Do not mix `localhost` and `127.0.0.1`: browser identity is host-specific. Only the server reads the key. `.env`, `.data`, dependencies and built assets are excluded from source control. Existing local setup already has an ignored `.env`; do not overwrite it accidentally.

```sh
npm test          # deterministic tests, no model charges
npm run typecheck
npm run build    # production frontend bundle
npm run eval     # paid live model + judge evaluation, same allowed model
npm run eval -- --filter shoe-flow  # a four-turn scenario
npm run eval -- --list             # list scenarios without model calls
npm run check:catalog              # compare category slugs with the live API
npm run benchmark:decisions        # six paid experimental classification calls
```

The development command runs both services; `build` alone does not launch an application server. No Docker, hosted database, AI Gateway account, deployment, or login is required. The API defaults to port 3101; set PORT in the root .env to override it. Vite reads the same port setting for its proxy. Restart development after changing environment settings.

## Architecture and framework choice

```
React + TanStack Query → NestJS → @bazak/agent → Vercel AI SDK → gpt-6-luna
                     │                      │
                     │                catalog tools → DummyJSON
                     ↓
           in-memory key-value Map + atomic disk snapshots
```

The npm workspaces are `apps/web`, `apps/server`, `packages/agent`, `packages/shared`, and `packages/storage`. The agent has no server or frontend imports. Nest injects its runner and a conversation repository into application use cases, so HTTP lifecycle and persistence can be tested without paid generation.

The folders follow practical domain boundaries. On the server, `conversations/domain` holds transitions and ports; `application` holds submit, query and generation use cases; `infrastructure` implements snapshot storage, admission control and poll notifications; `presentation` contains Nest controllers, validation pipes, the origin guard and error mapping. On the web, conversation query hooks and cache policies are separate from HTTP/browser adapters, message merging and UI components. Catalog cards and discovery presentation have their own folder. We use functions and types where they suffice rather than creating entity classes for UI state.

NestJS replaces the original manual HTTP dispatcher to make routing, injection, validation and error handling explicit. The tradeoff is framework/decorator knowledge and more dependencies. Raw Node HTTP was initially sufficient but mixed transport and generation lifecycle in one large function. A small Fastify server could also work, but would leave more application-boundary conventions for us to maintain. Explicit injection tokens avoid depending on emitted decorator metadata in the local TypeScript runner.

TanStack Query owns server-state fetching, infinite pagination, mutations, retries and cancellation. TanStack Virtual handles long message lists. Message revisions prevent stale polling results replacing newer content; cache keys isolate conversations. Local React state is reserved for drafts, drawer visibility and navigation. We did not add TanStack Router or Form: this app has one screen and a simple composer, so those would add concepts without removing meaningful code.

The shared package provides runtime schemas and inferred types for products, messages, search state and API contracts, plus small shared rules for search identity and conversation status. Both the HTTP boundary and persistence validate those contracts. It contains no database, model provider or React dependencies. This avoids a generic utility package with unrelated responsibilities. See [the architecture walkthrough](docs/architecture.md) for the request path and tradeoffs.

Vercel AI SDK provides typed tools, model streaming, a bounded tool loop and structured judge output. Its ecosystem is useful for future expansion, but its SDK does not require Vercel hosting or AI Gateway. This implementation uses the OpenAI provider directly because the assignment supplies that credential. Provider migration still requires validating model behavior and options, even with an SDK abstraction.

Two alternatives considered:

- **LangChain:** this app has one read-only catalog integration and a short tool loop. Adding its orchestration abstractions would increase the code and concepts to explain without solving an additional requirement. Both approaches permit self-hosting; infrastructure freedom is not a difference unique to LangChain.
- **Direct OpenAI integration:** viable and smaller in dependency surface, but we would implement more streaming and tool-loop plumbing ourselves. The SDK gives us those primitives while keeping catalog retrieval and persistence explicit.

These are implementation rationales to review and rewrite in your own voice before submission. The original user decisions and proposed refinements are in [the decision register](https://chatgpt.com/space/page_4319be7c69bc8191af62cd98f5002bbb). That private Page is not a substitute for this repository README.

## Retrieval strategy

The model chooses focused tools for keyword search (`searchProducts`), categories (`browseCategory`), descriptive attributes (`searchByAttributes`), exact brands (`searchByBrand`), and price ranges (`searchByPrice`). Tool schemas accept currency with a USD default. Generic searches take one to three caller-selected catalog categories and evidence filters, with positive terms, any/all matching and optional exclusions. There is no footwear-specific dispatcher or built-in style taxonomy. The same filter mechanism covers material, scent, features and style. Negative-only filters can express a preference such as excluding makeup without requiring it first. Positive terms are optional when exclusions exist. Unavoidable positive/exclusion contradictions are rejected before any catalog request; old contradictory records remain readable for inspection.

Each tool has its own schema and execution module. Candidate sources, HTTP transport, budgets, filtering and ranking are separate modules. Every search intersects all active constraints. Independent tool calls may run concurrently, but reserve attempts synchronously against the same three-request allowance. Generic multi-category searches return explicit coverage and per-category cursors. `continueSearch` preserves attributes, currency, price and brand. Legacy saved style searches remain readable but require reconstruction from the conversation rather than silently dropping their old filter. The implementation calls:

- `/products/search?q=...` for lexical search.
- `/products/category/{category}` for category browsing.
- Keyword/category requests use explicit `skip` and `limit` (agent default 4, retrieval default 8, maximum 20); multi-category discovery uses a 20-candidate page per requested category. The supplied specification documents `select` only on `/products`, so search/category responses are projected into our product model locally.

Price filters and ranking are applied locally to those candidates. Search terms are matched against title, description, category and brand. Score is the fraction of query terms appearing in that text; confidence currently equals this score. These are transparent heuristics, not calibrated confidence probabilities. Category-only results receive score 1, which indicates category retrieval rather than guaranteed relevance. All matching records in the candidate page are returned to the model. A separate `presentProducts` tool selects up to six verified IDs (normally two to four) for the UI; retrieval does not automatically render every candidate. For literal search, all query terms must match, and brand filtering uses the catalog brand field. Attribute terms come from the agent's interpretation of the request, rather than a hardcoded product-specific vocabulary. Matching checks normalized whole phrases in title, description and tags. All requested attributes must match; exclusions reject a candidate first. This is transparent evidence matching, not a semantic guarantee: missing aliases, implicit properties and negated wording can still reduce quality. The model inspects candidate descriptions before selecting cards. Sorting is page-local and does not guarantee globally cheapest products.

Each turn has a hard limit of three catalog attempts shared across all intents and failures. The model can reformulate after an empty result, preserving constraints. Each tool invocation retries network failures, HTTP 429 and 5xx at most once, with a short backoff, within the same three-request total. Permanent HTTP errors and malformed responses are not retried automatically. Empty results can trigger a constraint-preserving reformulation, not an automatic relaxation of brand or budget. Pagination returns upstream `total`, `hasMore`, and `nextSkip`; a page emptied by local filters can still have more candidates. Saved query state supports `continueSearch` across turns and refreshes, preserving constraints and excluding previously shown IDs. A legacy conversation without saved cursors may need a fresh search. Within one turn, identical successful candidate pages—including empty pages—and identical in-flight requests reuse evidence. The reuse key includes the full normalized query, attributes, currency, page and exclusions. Failures are not cached. Reused results report the current request budget and cannot rewind an advanced cursor. This prevents duplicate tool loops; it is not cross-turn hot-query caching. Upstream requests have an eight-second timeout and a process-wide limit of 30 per minute. The model loop has six steps and a 90-second deadline; automatic provider retries are disabled to keep costs bounded. There are at most 12 accepted chat turns per minute and three concurrent generations per server process.

For an underspecified request, the agent asks one useful question. Product type plus a usable constraint, or explicit browsing intent, is enough to search; budget is optional rather than a mandatory form field. It remembers the latest agreement: exact ranges remain strict until the user accepts alternatives, then the affected constraint changes without resurrecting an older cursor's budget. Informational questions about prices do not automatically trigger product cards. Follow-up questions and size disclaimers are used only when helpful or relevant. Product introductions stay brief while the cards carry item details. Off-catalog requests receive an honest explanation of what was checked. Multi-intent discovery shares the same request budget. These semantic behaviors still depend on the model; deterministic limits alone cannot prove correct intent interpretation.

Catalog errors are distinguished from no matches. Product card fields come from validated catalog records, not model-authored JSON. Product text is treated as untrusted evidence. The schema is a structural validation boundary; it does not prove the catalog is truthful. The API supplies numeric prices without a currency field. `CATALOG_CURRENCY` centralizes the application's USD convention. Tools accept a three-letter `currency` argument defaulting to USD; unsupported currencies fail before catalog HTTP requests, with a clear error instead of treating ILS/EUR as dollars. No FX conversion is implemented. Product cards carry currency and use `Intl.NumberFormat`; legacy cards default to USD. Adding a currency argument does not itself create a trustworthy exchange-rate service.

The per-turn request budget means no matches on inspected pages does not prove no product exists in the full catalog. The 24 category slugs match the live `/products/category-list` exactly as checked on 31 October 2026. The supplied OpenAPI file documents category discovery but does not enumerate the values. `npm run check:catalog` detects added or removed slugs. The maintained list keeps prompts and validation deterministic; it can drift until that check is rerun. Vector search, scheduled ingestion, reconciliation, hot-query caching, tenants and sharding are deferred. The dummy catalog does not justify their operational cost, and a key-value database alone is not a vector search engine.

## Conversation and state

A random HttpOnly, SameSite=Strict cookie identifies an anonymous browser. It is a bearer identity, not authentication or device fingerprinting. Cross-device access is deferred. The browser stores the selected conversation ID in localStorage and a pending submission ID/text in sessionStorage for safe retries after refresh; failure of that storage does not prevent server-side conversation persistence. If browser cookies are cleared, the old history remains on disk but the browser loses its association. No account recovery is provided.

Server storage is a Map indexed by conversation ID, persisted in `.data/conversations.json`. Each mutation is serialized, validated, written to a temporary file, flushed and atomically renamed before the new in-memory state is published. Titles derive from the first user message; timestamps and message IDs are stored with the conversation. This is a deliberately local single-process database. It rewrites the full snapshot and must not be shared by multiple processes. There is no quota enforcement, automatic backup, or eviction. File flushing does not include explicit directory metadata flushing, so power-loss guarantees are weaker than a production database.

If storage is full, accepted state is not silently discarded: failed writes leave previous memory state intact and produce an error. A transient error overlay prevents an endless spinner when generation checkpoints cannot be saved. Corruption stops startup without overwriting the damaged file. Preserve that file and restore a known-good backup, or explicitly move it aside to start fresh. Clearing the server data file while running is unsupported; stop the app before manual maintenance.

A POST persists the user message and a pending assistant message, then returns 202. Generation continues independently of the browser connection. Actual model deltas are checkpointed at roughly 120ms intervals; long polling waits for a new conversation revision, up to 20 seconds. Reopening a conversation retrieves saved state and resumes polling. Selected products are buffered on the server until the text finishes, then text and cards are committed together. The frontend also suppresses cards while pending/streaming or failed, and reveals completed cards with a reduced-motion-aware transition. The tradeoff is slightly later product visibility in exchange for a coherent introduction first. A request UUID makes retries idempotent; TanStack mutations reuse it after uncertain network failures, and the browser retains it until submission and the follow-up refresh succeed; only one response per conversation can run at once. A server restart marks unfinished responses as errors and retains partial text; it does not resume the lost upstream request.

History and messages use cursor pagination with pages of 20. Older message pages use stable message IDs. The web view virtualizes message rows and preserves position when older messages are prepended. Conversation ordering can change during pagination; refreshing the list restores the current order.

## Model context and compaction

Stored history and model context are different. Full history remains available in the UI, but the model receives at most the latest 30 messages and 24,000 characters, including compact product references and saved search cursors. The latest search registry is limited to 12 prior cursors, with up to three newly created searches per turn. Prompt indices and continuation indices use the same bounded registry. Older preferences can be forgotten. This is truncation, not summarization.

The installed OpenAI provider exposes server-side compaction options, and AI SDK supports message transformation in `prepareStep`. Automatic memory across separate turns still requires retaining and replaying the relevant provider state. That integration is deferred here. A useful next step is an explicit preference summary plus tests for preserving constraints through compaction.

## Evaluation and verification

Deterministic tests cover catalog argument translation, budget filtering, malformed responses, the three-attempt limit, upstream rate limiting, disk persistence, corrupt data, rollback, restart recovery, owner isolation, HTTP submission/polling, idempotency, storage-failure termination, and exact retrieval of 1,000 messages across 50 pages. Frontend merge/render tests check streaming replacement, pagination deduplication, text-before-cards ordering, safe text rendering, and hidden cards for incomplete or failed messages. Retrieval tests cover advancing cursors through filtered-empty pages and bounded transient retries. Context tests check the bounded model input.

Live evaluations live in `packages/agent/evals/scenarios/*.eval.ts`, with common execution, assertions, fixtures and judge code in `evals/support`. The CLI only selects and runs scenarios; ordinary `npm test` never triggers paid model calls. The live evaluation includes smartphone and explicit multi-intent baselines, broad shoes, recovery after an unsolicited result dump, specific shoe preferences, unsupported sizes, multi-turn pagination, and the exact new-shoes → sneakers-under-$500 → category/scope-followup regression, and asks `gpt-6-luna` to judge evidence-grounded behavior using typed output. Tool traces and product IDs also support deterministic assertions: clarification must make no catalog calls, next-page queries must preserve constraints, and subsequent cards must not repeat shown IDs. This is a custom evaluation runner built on SDK primitives; it is not a claim that the SDK automatically supplies an evaluation suite. The judge receives both the displayed shortlist and all retrieved candidates so a justified rejection of an unselected product can be assessed correctly. The same model can share blind spots with the agent. Judge results vary and add API cost. Each observation is saved before judging; a missing or malformed verdict gets at most one judge-only retry and then fails the evaluation rather than dropping the evidence.

The final local verification passed **100 deterministic tests across 23 files**, full type checking and the frontend production build. The latest scoped natural-conversation results are **budget 4/4, discovery 2/2, currency 2/2 and stock 1/1**, selected from separate live runs, not one clean nine-case run. The currency cases passed in an earlier overall 5/9 run; original failures remain evidence. A final generic instruction to stop after complete coverage was added after those paid runs and has not been rerun live. The full live registry contains 23 cases and was not rerun in full against the final source snapshot.

Earlier live shoe and browser checks are historical evidence. A prior browser walkthrough confirmed a real fragrance query, product cards and history surviving refresh; no fresh full-browser walkthrough is claimed for the final generic implementation. Deterministic tests validate HTTP, storage, shared contracts, retrieval limits, page reuse, generic attributes, currency errors and component/cache behavior. They do not prove visual layout, model interpretation, provider availability or semantic completeness. The live judge does not exercise the browser. There is no automated full-browser end-to-end suite yet.

## Limitations and another week

Priorities would be: broader multi-turn evaluation with adversarial constraint changes; automatic browser tests for refresh during generation and 1,000-message scrolling; persistent structured preferences/compaction; better semantic relevance and global ranking across catalog pages; a production storage engine and durable generation queue; and stronger identity if cross-device use is needed. Auth, checkout, real inventory and currency conversion are outside scope.

The landing page uses decorative CSS product illustrations rather than photos of people. Actual result cards use catalog images. Motion respects reduced-motion preferences. The supplied [OpenAPI YAML](docs/dummyjson_products_openapi.yaml) has been reconciled with the implementation. Search uses documented `q` and `limit`; category browsing uses the category slug and `limit`. Price bounds and sorting are local because these endpoints do not document those query parameters. We deliberately do not use the optional category discovery or single-product endpoints in this version. The provided file is preserved unchanged; it is a simplified reference (its top-level `description` would need moving under `info` before strict OpenAPI validation/code generation).

The source repository is private at https://github.com/itsmiclev/bazak-shopping-copilot. No submission email has been sent. Before submitting, review the code, rewrite the reasoning in your own words, and ensure the ignored credential and conversation data are absent from the Git repository.

## Shoe recall audit and Decisions experiment

The observed `q=sneakers` search returned only IDs 91 and 92. Auditing both shoe categories found two additional supported matches: Nike Air Jordan 1 (88, singular sneaker in its description) and Puma Future Rider Trainers (90). The generic attribute tool can retrieve all four using caller-supplied sneaker/trainer aliases and reports which categories/pages were inspected. This case is a regression fixture, not a special production branch. Never infer global catalog completeness from a keyword result count. Category questions retain the current shoe context. See `docs/shoe-search-review.md` for the audit and tradeoffs.

Decisions remains an isolated experiment, not a production dependency. Run `npm run benchmark:decisions` from the root with the assignment key to compare typed routing/candidate judgments; this makes six paid calls to gpt-6-luna. On the recorded three trials per API, Decisions median was 452 ms and structured Responses 2864 ms; both identified the four candidates correctly. This excludes retrieval/final prose and is too small to establish production latency or accuracy. A future integration should replace a planning/ranking call, not prepend another call to the same loop. Fixed choices/predicates do not replace exact arbitrary numeric budget extraction or natural response generation.

## Agent construction and conversation quality

`packages/agent/src/agent.ts` composes context, a per-turn retrieval session, verified product selection and tool definitions. AI SDK `streamText` runs a bounded loop with the OpenAI Responses model `gpt-6-luna`, at most six model steps and a 90-second deadline. Retrieval gathers candidates; `presentProducts` selects retrieved IDs; final text and selected cards flow back to the server. Decisions API is used only by the optional benchmark, not by the conversation agent.

The latest conversation review found stale budget reuse after accepting cheaper alternatives, repeated unnecessary size warnings, unverified shoe-style claims and overly narrow personal-care discovery. The prompt now emphasizes the current agreement, useful action and grounded answers rather than prescribed category-specific scripts. `natural-flow` evaluations cover changing an accepted budget, informational price questions, personal care beyond makeup, unsupported currencies and inventory claims. See `docs/conversation-quality-review.md`.
