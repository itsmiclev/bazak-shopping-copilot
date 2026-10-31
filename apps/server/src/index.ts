import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConversationStore } from "@bazak/storage";
import { runAgent } from "@bazak/agent";
import { createApp } from "./app.js";
const root = fileURLToPath(new URL("../../../", import.meta.url));
try {
  process.loadEnvFile(resolve(root, ".env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
const store = await ConversationStore.open(
  process.env.DATA_PATH ?? resolve(root, ".data/conversations.json"),
);
const app = await createApp(store, runAgent, {
  available: () => Boolean(process.env.OPENAI_API_KEY),
});
await app.listen(Number(process.env.PORT ?? 3101), "127.0.0.1");
console.log(`Shopping API ready at ${await app.getUrl()}`);
