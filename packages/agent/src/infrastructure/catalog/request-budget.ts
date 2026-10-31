import { RetrievalError } from "../../domain/catalog/types.js";

export class RateLimiter {
  private times: number[] = [];
  constructor(
    private limit = 30,
    private windowMs = 60_000,
    private now = Date.now,
  ) {}
  take() {
    const now = this.now();
    this.times = this.times.filter((time) => now - time < this.windowMs);
    if (this.times.length >= this.limit)
      throw new RetrievalError(
        "Catalog request limit reached. Please try again in a minute.",
      );
    this.times.push(now);
  }
}
export const globalCatalogLimiter = new RateLimiter();

export class RequestBudget {
  private used = 0;
  constructor(
    private limiter: RateLimiter,
    readonly maximum = 3,
  ) {}
  get attempts() {
    return this.used;
  }
  get remaining() {
    return this.maximum - this.used;
  }
  error(message: string, retryable = false) {
    return new RetrievalError(
      message,
      this.used,
      this.remaining,
      retryable && this.remaining > 0,
    );
  }
  reserve() {
    // Reservation is synchronous, before HTTP or backoff awaits, so parallel tools cannot overspend.
    if (!this.remaining)
      throw this.error(
        "The three catalog attempts for this turn have been used. Ask the user to refine their request.",
      );
    try {
      this.limiter.take();
    } catch (error) {
      throw this.error(
        error instanceof Error
          ? error.message
          : "Catalog request limit reached.",
      );
    }
    this.used++;
  }
}
