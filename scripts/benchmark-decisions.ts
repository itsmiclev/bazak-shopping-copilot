import { experimental_decide, generateText, Output } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
process.loadEnvFile(".env");
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const products = JSON.parse(
  await readFile("packages/agent/tests/fixtures/shoes.json", "utf8"),
) as {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
}[];
const state = {
  conversation: [
    { role: "user", text: "i want new shoes" },
    { role: "assistant", text: "What kind of shoes and budget?" },
    { role: "user", text: "sneakers up to 500$" },
  ],
  candidates: products.map(({ id, title, description, price, category }) => ({
    id,
    title,
    description,
    price,
    category,
  })),
};
const criteria = {
  clarify: "Missing useful product type/style and budget; ask followup.",
  search: "Enough preferences or explicit browsing; search.",
  off_catalog: "Not shopping for available product types.",
};
const instructions =
  "Use only supplied catalog evidence. Sneaker includes singular sneaker and trainers; exclude baseball cleats, slippers, heels and ambiguous casual shoes without evidence of sneaker style. Budget is inclusive $500. Do not infer the user gender.";
const questions: any = {
  route: {
    type: "choice",
    instructions:
      "Choose the next action for the latest user message using the conversation.",
    criteria,
  },
};
for (const p of products)
  questions[`product_${p.id}`] = {
    type: "boolean",
    instructions: `${instructions} Is candidate ${p.id} a supported match to the latest request?`,
  };
const schema = z.object({
  route: z.enum(["clarify", "search", "off_catalog"]),
  matches: z.array(z.object({ id: z.number().int(), match: z.boolean() })),
});
const results: any[] = [];
for (let trial = 0; trial < 3; trial++) {
  for (const mode of trial % 2
    ? ["responses", "decisions"]
    : ["decisions", "responses"]) {
    const start = performance.now();
    try {
      let route: string, ids: number[], usage: unknown;
      if (mode === "decisions") {
        const r = await experimental_decide({
          model: openai.decisionModel("gpt-6-luna"),
          state,
          questions,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(60000),
        });
        route = (r.answers.route as any).choice;
        ids = products
          .filter(
            (p) => (r.answers[`product_${p.id}`] as any).probability >= 0.5,
          )
          .map((p) => p.id);
        usage = r.usage;
      } else {
        const r = await generateText({
          model: openai.responses("gpt-6-luna"),
          instructions: `${instructions} Choose route with these definitions: ${JSON.stringify(criteria)}. Evaluate all candidates, returning one match boolean per candidate.`,
          prompt: JSON.stringify(state),
          output: Output.object({ schema }),
          maxOutputTokens: 1000,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(60000),
        });
        route = r.output.route;
        ids = r.output.matches.filter((p) => p.match).map((p) => p.id);
        usage = r.usage;
      }
      const row = {
        mode,
        trial: trial + 1,
        ms: Math.round(performance.now() - start),
        route,
        ids: ids.sort((a, b) => a - b),
        pass:
          route === "search" &&
          JSON.stringify([...ids].sort((a, b) => a - b)) ===
            JSON.stringify([88, 90, 91, 92]),
        usage,
      };
      results.push(row);
      console.log(JSON.stringify(row));
    } catch (e) {
      const row = {
        mode,
        trial: trial + 1,
        ms: Math.round(performance.now() - start),
        error: e instanceof Error ? e.message : "Unknown error",
      };
      results.push(row);
      console.log(JSON.stringify(row));
    }
  }
}
await mkdir("outputs", { recursive: true });
await writeFile(
  "outputs/decisions-benchmark.json",
  JSON.stringify(
    {
      scope:
        "Three trials per API on the same fixed conversation and ten product candidates. Classification-only; excludes retrieval and final reply. Threshold0.5 is experimental, not calibrated. Small exploratory benchmark, not production latency statistics.",
      results,
    },
    null,
    2,
  ),
);
