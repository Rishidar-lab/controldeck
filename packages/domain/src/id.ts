import { randomUUID } from "node:crypto";

/** Every id is minted through an IdGenerator, never `crypto.randomUUID()` directly — lets tests assert on deterministic, readable ids instead of random ones. */
export interface IdGenerator {
  next(prefix: string): string;
}

export class UuidIdGenerator implements IdGenerator {
  next(prefix: string): string {
    return `${prefix}_${randomUUID()}`;
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
