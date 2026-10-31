import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { ConversationStore } from "@bazak/storage";
import type { RunAgent } from "@bazak/agent";
import { ConversationsModule } from "./conversations/conversations.module.js";
import type { ServerOptions } from "./conversations/application/tokens.js";
import { httpContext } from "./conversations/presentation/http-context.js";
import { LocalOriginGuard } from "./conversations/presentation/local-origin.guard.js";
import { ApiErrorFilter } from "./conversations/presentation/api-error.filter.js";

/** Composition root used by both the local entry point and real HTTP integration tests. */
export async function createApp(
  store: ConversationStore,
  agent: RunAgent,
  options: ServerOptions = {},
) {
  const app = await NestFactory.create<NestExpressApplication>(
    ConversationsModule.register(store, agent, options),
    { logger: false, bodyParser: false },
  );
  app.use(httpContext);
  app.useBodyParser("json", { limit: 16_384, strict: false, type: () => true });
  app.useGlobalGuards(new LocalOriginGuard());
  app.useGlobalFilters(new ApiErrorFilter());
  await app.init();
  return app;
}
