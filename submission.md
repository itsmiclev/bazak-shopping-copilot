# Bazak AI Agent Commerce submission

**Project:** finds, a locally runnable shopping copilot using the DummyJSON Products API and `gpt-6-luna`.

**Repository:** [itsmiclev/bazak-shopping-copilot](https://github.com/itsmiclev/bazak-shopping-copilot).

The application supports conversational product discovery, product cards within chat, persistent history, and continuing previous conversations. It uses a TypeScript monorepo with React, NestJS, Vercel AI SDK, and a small local key-value store backed by atomic disk snapshots. No hosted deployment is required.

## Start here

| Document | What it covers |
| --- | --- |
| [README.md](README.md) | Setup, framework alternatives, retrieval, state, evaluation and limitations requested in the assignment |
| [architecture.md](architecture.md) | Package boundaries, the request lifecycle, persistence and application tradeoffs |
| [agent-architecture.md](agent-architecture.md) | Model construction, tools, context, retrieval constraints and failure modes |
| [verification.md](verification.md) | Reproduction commands, recorded test results and the limits of the evidence |
| [Catalog specification](docs/dummyjson_products_openapi.yaml) | The supplied OpenAPI reference |
| [Conversation quality review](docs/conversation-quality-review.md) | Observed failures and the changes motivated by them |
| [Shoe recall audit](docs/shoe-search-review.md) | Why a keyword-only search missed valid products and how retrieval changed |

## Setup and run

Requires Node.js 22.12 or newer, npm, internet access to OpenAI and DummyJSON, and the assignment's OpenAI key.

```sh
git clone https://github.com/itsmiclev/bazak-shopping-copilot.git
cd bazak-shopping-copilot
npm ci
cp .env.example .env
# Set OPENAI_API_KEY in .env to the assignment key.
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API defaults to port 3101. Vite reads the same `PORT` setting from the root environment file. Use the same browser hostname throughout because the anonymous cookie is host-specific. The private repository requires GitHub access before cloning. If a local `.env` already exists, preserve it instead of overwriting it.

Only `gpt-6-luna` is configured. The key stays on the server and is not included in the repository. The email states that assignment keys will be deactivated after the submission deadline; live chat and paid evaluations need a valid key. Deterministic tests do not need one.

## Assignment coverage

| Requirement | Implementation and evidence |
| --- | --- |
| Conversational interface | Search-first landing page transitions into chat; generated text arrives through revision-based long polling. |
| Product discovery | AI SDK tools query DummyJSON, validate records, intersect constraints and expose pagination and coverage. The model selects a grounded shortlist. |
| In-chat product widget | Horizontal product cards show title, description, image, price and rating. Cards appear after the response text completes. |
| Persistence across refresh | Server-side snapshots store conversations and generation progress; an anonymous browser cookie retains ownership. |
| Conversation management | New chat, paginated history drawer, titles, timestamps, continuing previous chats, and virtualized message rows. |
| Tests and evaluation | Deterministic retrieval, HTTP, storage and component tests plus separate paid agent scenarios with hard assertions and an LLM judge. See [verification](verification.md). |
| README rationale | Concrete SDK alternatives, retrieval behavior, storage failure behavior, evaluation gaps and next steps are documented in [README](README.md). |
| Local operation | `npm run dev` starts both services. No Vercel deployment, AI Gateway account, external database or application login is needed. |

## Decisions and tradeoffs

### Frameworks

Vercel AI SDK supplies typed tools, streaming and a bounded tool loop while leaving retrieval and persistence explicit. It does not require Vercel hosting or AI Gateway. LangChain was considered, but its broader orchestration layer would add concepts without solving another requirement for this one-catalog app. Direct OpenAI integration was also considered; it would reduce the SDK dependency but require maintaining more loop and streaming plumbing.

NestJS provides explicit controllers, validation, dependency injection and error mapping after the original raw HTTP dispatcher became difficult to follow. Its cost is additional dependencies and framework conventions. React uses TanStack Query for paginated server state and cancellable polling, and TanStack Virtual for long conversations. Router and Form were deferred because the single-screen application does not need their additional concepts.

### Retrieval and natural conversation

Dedicated keyword, category, generic attribute, brand and price tools share the same search implementation and request budget. Search uses `/products/search?q=...`; category browsing uses `/products/category/{category}`. Both use `skip` and `limit`. Price, brand and descriptive attribute checks run locally against returned candidates. Sorting is page-local. No shoe-specific dispatcher or production style vocabulary remains.

Ambiguous requests get a useful clarification, while actionable requests and explicit browsing can proceed without a mandatory questionnaire. Off-catalog requests get a clear scope explanation; a partial search must not become a claim of catalog-wide absence. Multiple intents share three upstream attempts per turn, so unresolved portions must be acknowledged. Empty results allow constraint-preserving reformulation; transport retries and pagination spend the same allowance. User-approved preference changes override obsolete saved queries.

Currency is explicit and defaults to USD, the application's convention for the catalog's numeric prices. Unsupported currencies are rejected rather than relabeled or converted using an invented rate. Attribute matching is based on text evidence and remains vulnerable to missing aliases and implicit properties. The model's final selection helps, but does not guarantee semantic correctness.

### Conversation state and recovery

A server-side Map backed by atomic disk snapshots keeps the local setup simple and survives normal restarts. It rewrites the whole snapshot and supports only one process. The browser cookie is an anonymous bearer identity, not authentication; cross-device recovery is deferred.

Failed disk writes preserve previously committed state and surface an error. Corruption stops startup without silently overwriting the file. Clearing browser storage can lose the selected chat or pending request; clearing the cookie loses access to old history. Clearing the server data file while the process is running is unsupported. A browser disconnect does not cancel generation, but a server restart marks interrupted generations as errors rather than resuming the provider request.

Full history is stored, while model context is limited to 30 recent messages, 24,000 characters and a bounded registry of 12 prior search cursors. Automatic compaction is deferred; this is lossy truncation, so old preferences may be forgotten.

### Evaluation and Decisions API

The recorded local suite passes 100 deterministic tests across 23 files, type checking and the frontend build. The latest nine natural-flow checks passed across separate targeted runs; this is not one clean full-suite replay. The final generic stop-rule prompt sentence was added after those paid runs. [Verification](verification.md) explains the evidence, initial failures, browser gaps and judge limitations.

The production agent uses OpenAI Responses through AI SDK. Decisions API is an isolated benchmark only. Three trials per API were promising for typed classification latency, but exclude retrieval and prose and do not establish a production speedup. A future integration should replace a planning or ranking call rather than add another call ahead of the same loop.

## Suggested reviewer walkthrough

1. Start a new conversation with “I'm looking for shoes.” Check that the assistant asks a useful clarification.
2. Specify a type and USD budget. Check that the response introduces relevant cards without repeating every card field.
3. Ask about an unavailable property such as size. Check that the assistant distinguishes catalog evidence from unavailable variant inventory.
4. Accept a proposed change in budget or style and continue. Check that later searches use the latest agreement.
5. Refresh during or after a reply, open the history drawer, start another chat, and return to the previous conversation.
6. Try a non-footwear query such as “Show me fragrances under 80 US dollars,” an ambiguous request, and an off-catalog request such as a flight to Tokyo.

These are manual review steps, not a claim that every outcome is deterministic. Model responses and the external catalog can change.

## Known limitations and another week

The most valuable next work would be a broader multi-turn regression set, an automated browser journey covering refresh during generation and long-history scrolling, and persistent structured preferences with tested compaction. Retrieval would benefit from stronger semantic matching and ranking across pages. A production deployment would need a durable database and generation queue, stronger identity, and operational monitoring. Checkout, real size/variant inventory, multi-device recovery, currency conversion, product ingestion, vector indexing, sharding and cross-turn hot-query caching are outside this local assignment.

## Submission handoff

The email requests a reply containing the Git repository link by **Thursday, 5 November 2026, 23:59**. The repository is currently private. Ensure the interviewer has access before sending the link; no reviewer access or visibility changes are included in this handoff. The submission email has not been sent.

Review the code and rationales before submission. AI assistance was used for implementation and evaluation; the candidate must be able to explain and defend the resulting choices. All required explanation is in the repository, so reviewers do not need access to the private working Space.

Suggested reply in the original email thread:

> Hi,
>
> Here is my AI Agent Commerce assignment: https://github.com/itsmiclev/bazak-shopping-copilot
>
> The repository includes the locally runnable application, setup instructions, architecture and agent design, tests and evaluation evidence, tradeoffs, and known limitations. Please start with README.md; submission.md provides a requirement map and reviewer walkthrough.
>
> Thanks,
> Erez
