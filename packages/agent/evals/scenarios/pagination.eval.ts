import type { ExecuteCase, ReportFailure } from "../support/types.js";
export async function paginationScenario(
  execute: ExecuteCase,
  reportFailure: ReportFailure,
) {
  const first = await execute({
    name: "explicit browse first page",
    input:
      "I'd like to browse groceries. Show me four options, any kind is fine.",
    expected:
      "Respect explicit browse intent without further interrogation. Retrieve groceries and render a small relevant selection with brief text.",
    mustSearch: true,
  });
  const next = await execute({
    name: "more options preserves search",
    input: "Show me more options",
    history: first.history,
    expected:
      "Continue the preceding grocery search using the saved next page. Do not repeat shown cards. Keep response brief; if the catalog has no further page explain it honestly.",
    mustSearch: true,
  });
  const duplicates = next.products.filter((p) =>
    first.products.some((old) => old.id === p.id),
  );
  const continued = next.calls.some((c) => c.name === "continueSearch");
  const expectsMore = first.searches.some((s) => s.hasMore);
  if (
    duplicates.length ||
    !continued ||
    (expectsMore && !next.products.length)
  ) {
    reportFailure({
      name: "pagination hard assertions",
      countAsFailure: next.passed,
      pass: false,
      duplicateIds: duplicates.map((p) => p.id),
      continued,
      expectedMore: expectsMore,
      returned: next.products.length,
    });
  }
}
