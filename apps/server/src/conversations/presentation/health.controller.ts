import { Controller, Get, Inject } from "@nestjs/common";
import { MODEL } from "@bazak/agent";
import { SERVER_OPTIONS, type ServerOptions } from "../application/tokens.js";
@Controller("api/health")
export class HealthController {
  constructor(
    @Inject(SERVER_OPTIONS) private readonly options: ServerOptions,
  ) {}
  @Get()
  health() {
    return {
      ok: true,
      model: MODEL,
      configured: this.options.available?.() ?? true,
    };
  }
}
