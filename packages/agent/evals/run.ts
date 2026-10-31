import { fileURLToPath } from "node:url";
import { cases } from "./scenarios/baseline.eval.js";
import { paginationScenario } from "./scenarios/pagination.eval.js";
import { shoeFlowScenario } from "./scenarios/shoe-flow.eval.js";
import {
  naturalBudgetScenario,
  naturalDiscoveryScenario,
  naturalCurrencyScenario,
  naturalStockScenario,
} from "./scenarios/natural-flow.eval.js";
import { executeCase } from "./support/execute.js";
import type { ExecuteCase } from "./support/types.js";
try {
  process.loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
} catch {}
const option = process.argv.indexOf("--filter");
const filter = (
  option >= 0 ? process.argv[option + 1] : process.env.EVAL_CASE
)?.toLowerCase();
if (option >= 0 && !filter)
  throw new Error("Use --filter <scenario substring>.");
const naturalScenarios = {
  "natural-budget": naturalBudgetScenario,
  "natural-discovery": naturalDiscoveryScenario,
  "natural-currency": naturalCurrencyScenario,
  "natural-stock": naturalStockScenario,
};
const paginationName = "pagination explicit browse more options";
const names = [
  ...cases.map((test) => test.name),
  paginationName,
  "shoe-flow",
  ...Object.keys(naturalScenarios),
];
if (process.argv.includes("--list")) {
  console.log(names.join("\n"));
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY)
  throw new Error(
    "Set OPENAI_API_KEY before running the paid live evaluation.",
  );
let total = 0,
  failed = 0;
const execute: ExecuteCase = async (test) => {
  const result = await executeCase(test);
  total++;
  if (!result.passed) failed++;
  return result;
};
for (const test of cases.filter(
  (test) => !filter || test.name.toLowerCase().includes(filter),
))
  await execute(test);
if (!filter || paginationName.includes(filter))
  await paginationScenario(execute, (detail) => {
    if (detail.countAsFailure !== false) failed++;
    console.log(JSON.stringify(detail));
  });
if (!filter || "shoe-flow".includes(filter)) await shoeFlowScenario(execute);
for (const [name, scenario] of Object.entries(naturalScenarios)) {
  if (!filter || name.includes(filter)) await scenario(execute);
}
if (!total) throw new Error(`No evaluation cases match ${filter}`);
console.log(
  `${total - failed}/${total} cases passed. Same-model judging can share blind spots; tool traces and deterministic assertions are separate gates.`,
);
process.exitCode = failed ? 1 : 0;
