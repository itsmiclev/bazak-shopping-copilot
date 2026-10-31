import { Injectable, type OnModuleDestroy } from "@nestjs/common";

/** Poll waiters end on a new revision, timeout, disconnect, or application shutdown. */
@Injectable()
export class ConversationEvents implements OnModuleDestroy {
  private readonly waiters = new Map<string, Set<() => void>>();
  notify(id: string) {
    for (const wake of [...(this.waiters.get(id) ?? [])]) wake();
  }
  wait(id: string, timeoutMs: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.waiters.get(id)?.delete(done);
        if (!this.waiters.get(id)?.size) this.waiters.delete(id);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      if (!this.waiters.has(id)) this.waiters.set(id, new Set());
      this.waiters.get(id)!.add(done);
      signal.addEventListener("abort", done, { once: true });
    });
  }
  onModuleDestroy() {
    for (const id of [...this.waiters.keys()]) this.notify(id);
  }
}
