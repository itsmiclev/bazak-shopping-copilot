# Verification and evaluation evidence

Recorded on **31 October 2026**. The application source passed the deterministic checks below. This documentation update does not change application behavior or constitute another live model run.

## Reproduce local checks

```sh
npm ci
npm test
npm run typecheck
npm run build
```

| Check | Recorded result | Scope |
| --- | --- | --- |
| `npm test` | 100 tests passed across 23 files | No paid model calls |
| `npm run typecheck` | Passed | TypeScript workspace |
| `npm run build` | Passed | Production frontend bundle; does not start a production API server |

The suite covers retrieval argument translation, filtering and ranking, negative-only and contradictory attributes, currency validation, bounded retries and parallel attempts, cursor continuation and per-turn page reuse. Storage tests cover persistence, corruption, failed-write rollback and restart recovery. API tests cover ownership, acceptance, polling, idempotency and failure termination. Pagination tests retrieve 1,000 messages in 50 pages. Frontend tests cover revision merging, conversation isolation, pending request recovery, currency formatting and hiding cards until a response completes.

These are layered tests. HTTP integration tests can replace the model runner, catalog tests use controlled responses, and component tests exercise rendering separately. Together they catch contract and lifecycle regressions, but they are not a single automated user-input-to-live-provider-to-browser journey.

## Reproduce live evaluations

Set `OPENAI_API_KEY` in the ignored root `.env`. All agent and judge calls use `gpt-6-luna` and consume the assignment quota.

```sh
npm run eval -- --list
npm run eval -- --filter natural-budget
npm run eval -- --filter natural-discovery
npm run eval -- --filter natural-currency
npm run eval -- --filter natural-stock
npm run eval -- --filter shoe-flow
npm run eval
```

Scenarios live in [packages/agent/evals/scenarios](packages/agent/evals/scenarios). Shared execution records the response, tool calls, candidates and actual retrieval outcomes before hard assertions and judging. A missing or malformed verdict receives at most one judge-only retry and then fails the evaluation. `--list` does not call the model. The full registry contains 23 cases, including multi-turn scenarios.

| Latest scoped run | Result | Interpretation |
| --- | --- | --- |
| Budget changes and accepted alternatives | 4/4 | Targeted budget replay |
| Personal-care discovery and contextual follow-up | 2/2 | Targeted discovery replay |
| Unsupported currency and explicit USD correction | 2/2 | Currency cases from the initial overall 5/9 run |
| Grounded inventory claims | 1/1 | Targeted stock replay |

These results come from separate runs, not one clean nine-case replay or a full final-registry pass. The final generic instruction to stop after complete coverage was added after those paid runs and **has not been rerun live**. The [sanitized evaluation record](docs/evaluation/natural-flow-evaluation.json) preserves case identifiers, verdicts, product IDs, tool names and source-log hashes, including historical failures and a separately labeled judge-only re-evaluation. It excludes real saved conversations and raw provider payloads. Referenced source-log names identify local audit artifacts; they are not additional files required to run the repository.

Initial failures included unnecessary clarification, showing alternatives during an informational price question, poor contextual fragrance discovery and unsupported availability claims. Another judgment misread a generic pagination note as evidence that more pages existed. The judge now receives actual retrieval outcomes and coverage, distinguishing a failed request from a successful empty page. Retaining failed runs makes the improvement traceable without relabeling them as successes.

## What the evidence misses

The same model acts as agent and judge, so they can share blind spots. A passing verdict does not prove intent interpretation, semantic relevance, complete recall, correct tone in every conversation, or resistance to every malicious catalog description. Word-based filtering can miss implicit properties and negation. Three upstream attempts can leave pages or intents unresolved.

Manual browser checks exercised a real fragrance query, product cards and refresh persistence. A later spot check exercised a citrus-to-fresh preference change under a $100 ceiling. There is no automated full-browser end-to-end suite and no complete final-version walkthrough covering every journey. Component and HTTP tests do not establish visual layout, scroll behavior on every device, or performance under sustained load.

The 24 configured category slugs matched DummyJSON's live category-list endpoint on this date. Run `npm run check:catalog` to detect future drift. This was a point-in-time comparison, not a guarantee that the external catalog stays unchanged.

## Source and credentials

The source handoff includes the five workspaces, lockfile, configuration, supplied catalog specification, test fixtures, scripts and submission documentation. `.gitignore` excludes `.env` and other local environment files, `.data`, dependencies, build output, temporary work, generated outputs, logs and private key files; `.env.example` remains included.

The source archive was checked for credential patterns and configured secret values without printing them. Its entries were compared with the selected source files and its integrity was checked. The ignore rules were tested in an isolated temporary Git repository because the local workspace was not itself a Git checkout. No saved chat data or actual API key belongs in the handoff. The only environment template uses placeholders.

The repository is private. Uploading source is separate from granting interviewer access or sending the submission email; those steps have not been performed.
