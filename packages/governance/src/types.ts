import type { ReasonCode } from "@controldeck/contracts";

export type GovernanceOutcome = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

/**
 * The composition-wide decision. Deliberately a 3-way outcome (same shape
 * as ActionHarbor's own `PolicyOutcome`) rather than the 7 named concepts
 * in this gate's instructions (`ALLOW/DENY/REQUIRES_APPROVAL/
 * BLOCKED_EVIDENCE/BLOCKED_CONFLICT/BLOCKED_STALE/BLOCKED_POLICY`) —
 * those 7 are "conceptually equivalent to," not required as literal enum
 * values, and `reasonCodes` already carries the full specificity: an
 * `EVIDENCE_INSUFFICIENT`/`CONTRADICTED_EVIDENCE` reason on a `DENY` IS
 * "BLOCKED_EVIDENCE"; `SNAPSHOT_CHANGED` IS "BLOCKED_STALE";
 * `FORBIDDEN_TOOL`/`COMPOSITION_VIOLATION`/`COMPOSITION_DRIFT` IS
 * "BLOCKED_POLICY" — the same "3 outcomes, specific reason codes carry the
 * rest" discipline `evaluatePolicy` already proved out.
 */
export interface GovernanceDecision {
  readonly outcome: GovernanceOutcome;
  readonly reasonCodes: readonly ReasonCode[];
  readonly policyVersion: string;
}

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

/**
 * A Risk Specialist's structured output (Gate 4 will define the full agent
 * contract; this is the shape governance reads). `rationale` is present
 * ONLY for audit/display — `evaluatePolicyGate` never reads it; see
 * `policy-gate.test.ts`'s injection-invariance test for the proof.
 */
export interface RiskAssessment {
  readonly actionId: string;
  readonly riskLevel: RiskLevel;
  readonly rationale?: string;
}

/**
 * An already-validated, structured summary of a proposed action —
 * deliberately NOT the raw agent artifact. Producing this safely from
 * untrusted agent output is Gate 4's job (parsing + stripping any field
 * that pretends to be authoritative); this type has no field for a
 * "claimed approval," a "verified" flag, or any other authority claim, so
 * there is nothing for Gate 4's parser to even pass through if it tried.
 */
export interface ActionProposalSummary {
  readonly actionId: string;
  readonly actionType: string;
  readonly resourceId: string;
  readonly principalRole: string;
  readonly tenantId: string;
}

export interface PolicyGateInput {
  readonly proposal: ActionProposalSummary;
  readonly riskAssessments: readonly RiskAssessment[];
  readonly evidenceGate: EvidenceGateDecision;
  readonly forbiddenActionTypes: ReadonlySet<string>;
  readonly requestsNewSubAgentOrTool: boolean;
}

export type EvidenceGateOutcome = "SATISFIED" | "BLOCKED";

export interface EvidenceGateDecision {
  readonly outcome: EvidenceGateOutcome;
  readonly reasonCodes: readonly ReasonCode[];
}
