import { hashCanonical } from "@controldeck/domain";
import type { EvidenceRecord } from "./types.js";

export type IntegrityCheckResult = { readonly ok: true } | { readonly ok: false; readonly reasonCode: "EVIDENCE_INTEGRITY_FAILED" };

/**
 * Recomputes a record's hash from its own excerpt and compares against the
 * `contentHash` it was retrieved with (w4-028). A record altered — or
 * forged from nothing, with a `contentHash` that was simply invented —
 * after retrieval fails this and is excluded from ever supporting a claim.
 * Deliberately hashes ONLY the fields that make the record what it claims
 * to be (`sourceId`, `documentVersion`, `excerpt`) — `relevanceScore` and
 * `retrievedAt` are metadata about the retrieval, not the retrieved
 * content, and are not part of what integrity is protecting.
 */
export function verifyRecordIntegrity(record: EvidenceRecord): IntegrityCheckResult {
  const recomputed = hashCanonical({ sourceId: record.sourceId, documentVersion: record.documentVersion, excerpt: record.excerpt });
  if (recomputed !== record.contentHash) {
    return { ok: false, reasonCode: "EVIDENCE_INTEGRITY_FAILED" };
  }
  return { ok: true };
}

/** Convenience for constructing a record with a correct, real hash — the ONLY function evidence-source code should use to mint `contentHash`, mirroring how `computeProposalHash` is the sole legitimate way to produce a plan hash in ActionHarbor's domain package (an independently-derived analogue, not shared code). */
export function computeContentHash(input: { readonly sourceId: string; readonly documentVersion: string; readonly excerpt: string }): string {
  return hashCanonical(input);
}
