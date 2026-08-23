import type { ReasonCode } from "@controldeck/contracts";
import type { AuditLedgerEntry } from "./hash-chain.js";
import { computeEntryHash, GENESIS_HASH } from "./hash-chain.js";

/** Local diagnostic detail — WHICH check failed, for logs/debugging. Every one of these maps to the single governed `ReasonCode` (`AUDIT_INTEGRITY_FAILED`, w4-013) a caller actually reports/audits — see `AUDIT_INTEGRITY_FAILED_REASON_CODE` below, same "governed code + local diagnostic detail" split as Gate 6's `PRECONDITION_FAILED` + `driftedDimensions`. */
export type LedgerIntegrityReasonCode = "SEQUENCE_GAP" | "PREV_HASH_MISMATCH" | "HASH_MISMATCH" | "CHAIN_LENGTH_MISMATCH";

export type LedgerIntegrityResult = { readonly ok: true; readonly checkedEntries: number } | { readonly ok: false; readonly reasonCode: LedgerIntegrityReasonCode; readonly brokenAtSequence: number };

/** The one governed `ReasonCode` any integrity failure reports as, regardless of which specific check caught it (`transition(state, "audit_integrity_failed") -> PAUSED` is legal from every non-terminal state, Gate 1). */
export const AUDIT_INTEGRITY_FAILED_REASON_CODE: ReasonCode = "AUDIT_INTEGRITY_FAILED";

/**
 * Recomputes the hash chain from scratch over whatever entries are
 * handed in. Deliberately a PURE function over an array, not a method on
 * the live `AuditLedger` — this is what lets a test (or, in production,
 * a periodic integrity job) verify a COPY that may have been tampered
 * with out-of-band, without `AuditLedger` ever needing to expose any way
 * to construct itself from untrusted data.
 *
 * `expectedSequenceCount`, when supplied, additionally catches deleting
 * the single most-recent entry — which, by hash-chain shape alone, is
 * indistinguishable from "this ledger simply hasn't received that append
 * yet." A caller that separately knows how many entries should exist
 * (the live store's own count, or a previously recorded high-water mark)
 * should pass it.
 *
 * "Tamper-evident, not tamper-proof": this proves history changed; it
 * cannot by itself prevent someone with direct storage access from
 * changing it in the first place.
 */
export function verifyLedgerIntegrity(entries: readonly AuditLedgerEntry[], expectedSequenceCount?: number): LedgerIntegrityResult {
  let index = 0;
  let prevHash = GENESIS_HASH;
  for (const entry of entries) {
    const expectedSequence = index + 1;
    if (entry.sequence !== expectedSequence) {
      return { ok: false, reasonCode: "SEQUENCE_GAP", brokenAtSequence: expectedSequence };
    }
    if (entry.prevHash !== prevHash) {
      return { ok: false, reasonCode: "PREV_HASH_MISMATCH", brokenAtSequence: entry.sequence };
    }
    const { hash, ...withoutHash } = entry;
    const recomputed = computeEntryHash(withoutHash);
    if (recomputed !== hash) {
      return { ok: false, reasonCode: "HASH_MISMATCH", brokenAtSequence: entry.sequence };
    }
    prevHash = hash;
    index += 1;
  }

  if (expectedSequenceCount !== undefined && entries.length !== expectedSequenceCount) {
    return { ok: false, reasonCode: "CHAIN_LENGTH_MISMATCH", brokenAtSequence: expectedSequenceCount };
  }

  return { ok: true, checkedEntries: entries.length };
}
