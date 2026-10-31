import { CATALOG_CATEGORIES } from "@bazak/agent";

const response = await fetch("https://dummyjson.com/products/category-list", {
  signal: AbortSignal.timeout(8000),
});
if (!response.ok)
  throw new Error(`Category verification failed: HTTP ${response.status}`);
const live: unknown = await response.json();
if (
  !Array.isArray(live) ||
  live.some((category) => typeof category !== "string")
)
  throw new Error("Category verification failed: unexpected catalog response");
const configured = new Set<string>(CATALOG_CATEGORIES);
const current = new Set<string>(live);
const missing = [...current].filter((category) => !configured.has(category));
const removed = [...configured].filter((category) => !current.has(category));
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      configured: configured.size,
      live: current.size,
      missing,
      removed,
    },
    null,
    2,
  ),
);
process.exitCode = missing.length || removed.length ? 1 : 0;
