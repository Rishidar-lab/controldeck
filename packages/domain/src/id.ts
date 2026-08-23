/** Every id is minted through an IdGenerator, never `crypto.randomUUID()` directly — lets tests assert on deterministic, readable ids instead of random ones. */
export interface IdGenerator {
  next(prefix: string): string;
}

/**
 * Uses the Web Crypto global (`globalThis.crypto.randomUUID`) rather than
 * importing from `node:crypto` — both Node (>=19, this workspace requires
 * >=22) and every modern browser expose the identical method on the
 * global `crypto` object, so this one implementation runs unmodified in
 * `apps/web` (Gate 9) as well as every server-side package. A static
 * `import ... from "node:crypto"` here would make ANY bundle that
 * transitively imports this module (even one that never constructs a
 * `UuidIdGenerator`) fail to build for the browser — discovered exactly
 * that way while building Gate 9.
 */
export class UuidIdGenerator implements IdGenerator {
  next(prefix: string): string {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
}

/** Deterministic, monotonic ids for tests: `next("wf")` -> `wf_000001`, `wf_000002`, ... */
export class CounterIdGenerator implements IdGenerator {
  private counters = new Map<string, number>();

  next(prefix: string): string {
    const count = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, count);
    return `${prefix}_${String(count).padStart(6, "0")}`;
  }
}
