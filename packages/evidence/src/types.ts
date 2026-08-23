import type { ReasonCode } from "@controldeck/contracts";

/**
 * `EVIDENCE_MODEL.md`: a single retrieved record, never itself authority.
 * `contentHash` is what `verifyRecordIntegrity` checks — a record whose
 * `excerpt` doesn't hash to its own claimed `contentHash` has been altered
 * or forged after retrieval and cannot be used to support anything.
 */
export interface EvidenceRecord {
  readonly recordId: string;
  readonly sourceId: string;
  readonly documentVersion: string;
  readonly tenantId: string;
  readonly excerpt: string;
  readonly retrievalMethod: string;
  /** 0..1, informative only — never itself a pass/fail gate; that's `assessClaim`'s job. */
  readonly relevanceScore: number;
  readonly contentHash: string;
  readonly retrievedAt: string;
}

/** `EVIDENCE_MODEL.md`: "A new corpus version creates a new snapshot and invalidates downstream approvals." */
export interface EvidenceBundle {
  readonly bundleId: string;
  readonly snapshotId: string;
  readonly query: string;
  readonly records: readonly EvidenceRecord[];
  readonly gaps: readonly string[];
  readonly createdAt: string;
}

/**
 * A CLAIM: an assertion an agent (Planner or Executor) makes to justify a
 * step. `relatedRecordIds` is the agent's OWN pointer to which evidence it
 * thinks supports the claim — proposed, not authoritative; `assessClaim`
 * re-derives the real answer independently, the same way ActionHarbor's
 * `verifyPostcondition` re-derives success from a receipt's own fields
 * rather than trusting the adapter's narration.
 */
export interface Claim {
  readonly claimId: string;
  readonly text: string;
  readonly relatedRecordIds: readonly string[];
}

/**
 * `EVIDENCE_MODEL.md`'s four-way classification. `UNDECIDABLE` and
 * `CONTRADICTED` require semantic entailment this gate deliberately does
 * NOT implement (`submission/week4/EVALUATION_PLAN.md`: "semantic evidence
 * assessment has residual risk... must not retrofit fabricated results") —
 * `assessClaim` (Gate 2) produces only `SUPPORTED`/`UNSUPPORTED`, both
 * fully determined by structural/provenance checks; a later gate that adds
 * real semantic comparison (human-labelled corpus or a live model) is what
 * would ever produce the other two verdicts.
 */
export type ClaimVerdict = "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED" | "UNDECIDABLE";

/**
 * The VERIFIED FACT. This type is the whole point of this package: it can
 * only ever be constructed by `assessClaim` (see `assess-claim.ts`) — there
 * is no public constructor, no field an agent's own output could populate
 * directly. An agent's sentence "I verified this" is not one of these and
 * satisfies nothing (w4-004).
 */
export interface ClaimAssessment {
  readonly claimId: string;
  readonly verdict: ClaimVerdict;
  /** The subset of the claim's OWN relatedRecordIds that actually passed every structural check — may be empty even when relatedRecordIds is not. */
  readonly supportingRecordIds: readonly string[];
  readonly reasonCode?: ReasonCode;
}
