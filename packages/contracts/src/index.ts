import { z } from "zod";

/**
 * Single source of truth for ControlDeck's data shapes (submission/week4/ARCHITECTURE.md).
 * Gate 1 defines the workflow state machine's own vocabulary; artifact
 * schemas (PlanArtifact, EvidenceBundle, etc.) are added at the gates that
 * actually use them (Gate 2 onward), same discipline ActionHarbor's own
 * contracts package followed gate-by-gate.
 */

// ---------------------------------------------------------------------------
// Workflow state machine (submission/week4/ARCHITECTURE.md, "Workflow state
// machine — full per-transition table")
// ---------------------------------------------------------------------------

/**
 * All 15 states. Frozen in `05-week4/STATE_MACHINE.md`'s mermaid diagram
 * except where the architecture doc's per-transition table explicitly
 * documents a DESIGNED extension (see that doc for every row's SOURCE).
 */
export const WorkflowState = z.enum([
  "INTAKE",
  "PLAN_PENDING",
  "EVIDENCE_PENDING",
  "EVIDENCE_ASSESSED",
  "ACTION_PENDING",
  "POLICY_PENDING",
  "APPROVAL_PENDING",
  "EXECUTION_PENDING",
  "VERIFICATION_PENDING",
  "COMPLETE",
  "BLOCKED",
  "PAUSED",
  "CONFLICT",
  "RECONCILIATION_REQUIRED",
  "FAILED",
]);
export type WorkflowState = z.infer<typeof WorkflowState>;

/**
 * Every trigger deterministic code may fire to move a workflow between
 * states — mirrors ActionHarbor's `RunStateTrigger` discipline exactly:
 * there is no "retry anyway" or "continue anyway" trigger, matching
 * `ORCHESTRATION_MODEL.md`'s "No agent is allowed to 'continue anyway'."
 */
export const WorkflowStateTrigger = z.enum([
  "intake_accepted",
  "plan_valid",
  "plan_invalid",
  "evidence_returned",
  "claims_supported",
  "claim_blocked",
  "action_proposed",
  "duplicate_action_intent",
  "policy_requires_approval",
  "policy_allow",
  "policy_deny",
  "approval_matched",
  "approval_snapshot_changed",
  "approval_rejected",
  "approval_expired",
  "execution_resolved",
  "execution_unknown_outcome",
  "postcondition_pass",
  "postcondition_fail",
  "reconciliation_found",
  "reconciliation_inconclusive",
  "retry_budget_exhausted",
  "audit_integrity_failed",
  "model_authority_violation",
]);
export type WorkflowStateTrigger = z.infer<typeof WorkflowStateTrigger>;

/**
 * Every reason code a ControlDeck decision can report. Each is pinned by a
 * named case in `06-week4-evaluation/evaluation_corpus.json` (w4-xxx,
 * documented per-code below and in ARCHITECTURE.md's transition table),
 * except `APPROVAL_EXPIRED` — justified instead by `AGENT_CONTRACTS.md`'s
 * explicit 10-minute human-control TTL, since no corpus case exercises it.
 */
export const ReasonCode = z.enum([
  "GOAL_AMBIGUOUS", // w4-027
  "PLAN_CYCLE", // w4-029
  "EVIDENCE_INSUFFICIENT", // w4-002
  "CLAIM_UNSUPPORTED", // w4-017
  "CONTRADICTED_EVIDENCE", // w4-009
  "EVIDENCE_INTEGRITY_FAILED", // w4-028
  "CROSS_TENANT_EVIDENCE", // w4-016
  "EVIDENCE_IS_DATA_NOT_INSTRUCTION", // w4-003
  "UNTRUSTED_EVIDENCE_INSTRUCTION", // w4-014
  "DUPLICATE_ACTION_INTENT", // w4-008
  "FORBIDDEN_TOOL", // w4-005, w4-023
  "COMPOSITION_VIOLATION", // w4-005
  "COMPOSITION_DRIFT", // w4-015
  "APPROVAL_INVALIDATED", // w4-006
  "SNAPSHOT_CHANGED", // w4-006, w4-022, w4-025
  "HUMAN_REJECTED", // w4-019
  "APPROVAL_EXPIRED", // AGENT_CONTRACTS.md TTL — no corpus case
  "UNKNOWN_OUTCOME", // w4-011
  "POSTCONDITION_FAILED", // w4-030
  "INVALID_TOOL_OUTPUT", // w4-020
  "PARTIAL_FAILURE", // w4-024
  "VERIFICATION_REQUIRED", // w4-004
  "RETRY_EXHAUSTED", // w4-010
  "RETRY_BUDGET_EXHAUSTED", // w4-021
  "AUDIT_INTEGRITY_FAILED", // w4-013
  "MODEL_CANNOT_AUTHORITATIVE_EVENT", // w4-026
  "REPLAY_PROJECTION", // w4-012 (not a state-machine trigger — see projection note in domain package)
  "PRECONDITION_FAILED", // w4-007
]);
export type ReasonCode = z.infer<typeof ReasonCode>;

// ---------------------------------------------------------------------------
// Audit vocabulary (EVENT_SCHEMA.md + AGENT_CONTRACTS.md's per-agent audit
// event columns, merged and de-duplicated — neither source alone is
// exhaustive; see ARCHITECTURE.md's "Open Gate-1 decision" note)
// ---------------------------------------------------------------------------

export const AuditEventType = z.enum([
  "WORKFLOW_CREATED",
  "AGENT_STARTED",
  "ARTIFACT_RECORDED",
  "PLANNER_STARTED",
  "PLAN_PROPOSED",
  "PLANNER_FAILED",
  "RESEARCH_STARTED",
  "EVIDENCE_RETURNED",
  "EVIDENCE_ASSESSED",
  "EVIDENCE_INSUFFICIENT",
  "ACTION_PROPOSED",
  "GATEWAY_SUBMISSION",
  "VERIFICATION_STARTED",
  "VERIFICATION_REPORTED",
  "POLICY_EVALUATED",
  "APPROVAL_GRANTED",
  "APPROVAL_REJECTED",
  "APPROVAL_EXPIRED",
  "CAPABILITY_MINTED",
  "ACTION_EXECUTED",
  "POSTCONDITION_VERIFIED",
  "INVARIANT_VIOLATED",
  "RETRY_EXHAUSTED",
  "WORKFLOW_COMPLETED",
]);
export type AuditEventType = z.infer<typeof AuditEventType>;

/** `EVENT_SCHEMA.md`: "The model may produce an artifact that causes a server event, but it cannot emit an authoritative event directly." */
export const AuditActorKind = z.enum(["server", "human", "model", "tool"]);
export type AuditActorKind = z.infer<typeof AuditActorKind>;

export const AuditSubjectKind = z.enum(["workflow", "plan", "evidence", "action", "approval", "capability", "operation"]);
export type AuditSubjectKind = z.infer<typeof AuditSubjectKind>;
