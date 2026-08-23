import type { Clock, IdGenerator } from "@controldeck/domain";
import { type AuditEventInput, type AuditLedgerEntry, buildLedgerEntry, GENESIS_HASH } from "./hash-chain.js";

/**
 * The append-only, server-authored audit store. This class has exactly
 * ONE way to add data — `append` — and no method that updates, deletes,
 * replaces, or reorders an existing entry. That is not an access-control
 * check that could be bypassed; there is simply no such method on the
 * type, so "ordinary application paths must not mutate history" is a
 * compile-time fact about this class's surface, not a runtime guard
 * someone could route around.
 *
 * `list()`/`findByWorkflow()`/`findByOperation()` all return a frozen,
 * independently-allocated copy of the underlying array — mutating (or
 * even `.push()`-ing onto, which throws under `Object.freeze`) a
 * returned array can never reach back into the ledger's own state.
 *
 * "Tamper-evident, not tamper-proof" — this class, on its own, cannot
 * stop someone with direct access to its private state from mutating it
 * in-process; what it guarantees is that `verifyLedgerIntegrity`
 * (`integrity.ts`) will detect that mutation afterward.
 */
export class AuditLedger {
  private readonly entries: AuditLedgerEntry[] = [];

  constructor(
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  append(input: AuditEventInput): AuditLedgerEntry {
    const sequence = this.entries.length + 1;
    const last = this.entries.at(-1);
    const prevHash = last === undefined ? GENESIS_HASH : last.hash;
    const entry = buildLedgerEntry(input, sequence, prevHash, this.idGenerator, this.clock);
    this.entries.push(entry);
    return entry;
  }

  list(): readonly AuditLedgerEntry[] {
    return Object.freeze([...this.entries]);
  }

  findByWorkflow(workflowId: string): readonly AuditLedgerEntry[] {
    return Object.freeze(this.entries.filter((entry) => entry.workflowId === workflowId));
  }

  findByOperation(operationId: string): readonly AuditLedgerEntry[] {
    return Object.freeze(this.entries.filter((entry) => entry.operationId === operationId));
  }
}
