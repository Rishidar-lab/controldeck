/**
 * Everything a scenario run produces, for the UI to render. Every field
 * here is filled from a REAL call into a @controldeck/* package — never
 * hand-authored demo copy. `advisory: true` marks content that came from
 * a specialist/model and carries no authority on its own; everything
 * else on this type is either a deterministic system decision or a
 * direct, unmodified readout of one.
 */

export type SpecialistRole = "Planner" | "Researcher" | "Risk" | "Verifier";

export interface SpecialistOutputView {
  readonly role: SpecialistRole;
  readonly implemented: boolean;
  readonly advisory: true;
  readonly summary: string;
  readonly structuredOutput: unknown;
  readonly claimOrEvidenceRefs: readonly string[];
}

export type EvidenceKind = "CLAIM" | "EVIDENCE" | "VERIFIED_FACT";

export interface EvidenceItemView {
  readonly kind: EvidenceKind;
  readonly id: string;
  readonly text: string;
  readonly producer: string;
  readonly advisory: boolean;
  readonly source?: string;
  readonly integrity?: "VERIFIED" | "FAILED" | "N/A";
  readonly freshness?: "CURRENT" | "STALE" | "N/A";
  readonly verificationStatus?: string;
  readonly snapshotId?: string;
}

export interface GovernanceView {
  readonly outcome: "ALLOW" | "DENY" | "REQUIRE_APPROVAL";
  readonly reasonCodes: readonly string[];
  readonly policyVersion: string;
  readonly advisory: false;
}

export interface ApprovalView {
  readonly required: boolean;
  readonly status: "NOT_REQUIRED" | "PENDING" | "MATCHED" | "STALE" | "REJECTED";
  readonly proposalIdentity?: string;
  readonly evidenceSnapshot?: string;
  readonly resource?: string;
  readonly action?: string;
  readonly expiresAt?: string;
  readonly consumed?: boolean;
  readonly reasonCodes?: readonly string[];
  readonly advisory: false;
}

export interface ExecutionView {
  readonly authorityState: "AUTHORIZED" | "NOT_AUTHORIZED";
  readonly status: "NOT_STARTED" | "EXECUTING" | "RESOLVED" | "UNKNOWN_OUTCOME" | "BLOCKED";
  readonly receipt?: unknown;
  readonly sideEffectCount: number;
  readonly advisory: false;
}

export interface VerificationView {
  readonly preconditionResult: "PASS" | "FAIL" | "N/A";
  readonly adapterResult: "SUCCESS" | "ERROR" | "UNKNOWN" | "N/A";
  readonly postconditionResult: "PASS" | "FAIL" | "N/A";
  readonly authoritativeOutcome: "SUCCEEDED" | "FAILED" | "UNKNOWN_OUTCOME" | "N/A";
  readonly reasonCode?: string;
  readonly advisory: false;
}

export interface AuditEntryView {
  readonly sequence: number;
  readonly type: string;
  readonly actorKind: string;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly authoritative: true;
  readonly advisoryContent: boolean;
}

export interface ConflictView {
  readonly present: boolean;
  readonly description?: string;
  readonly resolution?: string;
}

export interface IntegrityView {
  readonly checked: boolean;
  readonly ok: boolean;
  readonly reasonCode?: string;
  readonly brokenAtSequence?: number;
}

export interface WorkflowSnapshot {
  readonly scenarioId: string;
  readonly scenarioTitle: string;
  readonly workflowId: string;
  readonly currentState: string;
  readonly objective: string;
  readonly evidenceSnapshotId: string;
  readonly governanceStatusLabel: string;
  readonly specialists: readonly SpecialistOutputView[];
  readonly evidence: readonly EvidenceItemView[];
  readonly governance?: GovernanceView;
  readonly approval: ApprovalView;
  readonly execution: ExecutionView;
  readonly verification: VerificationView;
  readonly audit: readonly AuditEntryView[];
  readonly conflict: ConflictView;
  readonly integrity: IntegrityView;
}
