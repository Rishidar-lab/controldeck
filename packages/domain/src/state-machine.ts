import type { WorkflowState, WorkflowStateTrigger } from "@controldeck/contracts";

/**
 * The workflow state machine (submission/week4/ARCHITECTURE.md, "Workflow
 * state machine — full per-transition table"). This table — and only this
 * table — defines which transitions exist; `transition()` is the only
 * function permitted to produce a next state, so "no agent can alter
 * workflow state" is a structural property of this module, not a
 * convention any caller has to remember to respect.
 *
 * Every row is explicit, including the cross-cutting `audit_integrity_failed`
 * / `model_authority_violation` triggers repeated on every non-terminal
 * state, and `retry_budget_exhausted` repeated on the two states whose
 * agents actually have a retry budget (`PLAN_PENDING` for the Planner,
 * `EVIDENCE_PENDING` for the Researcher — `AGENT_CONTRACTS.md`). Nothing is
 * built via a dynamic "any state" shortcut: every legal (state, trigger)
 * pair is a literal entry you can read and audit directly, matching
 * ActionHarbor's own `state-machine.ts` discipline.
 *
 * `CONFLICT` and `PAUSED` have no outgoing edges in this gate — an honest,
 * documented gap, not an oversight: neither the frozen spec nor this
 * project's own architecture doc yet defines a "resume a paused workflow"
 * or "resolve a conflict in place" trigger. Recovery from either is
 * expected to mean starting a fresh proposal/plan cycle (the same
 * resolution `STATE_MACHINE.md`'s `STALE` state uses in ActionHarbor), not
 * an in-place transition — a later gate may add one if the spec ever
 * defines it, but this gate will not invent one.
 */
const TRANSITION_TABLE: Readonly<Record<WorkflowState, Partial<Readonly<Record<WorkflowStateTrigger, WorkflowState>>>>> = {
  INTAKE: {
    intake_accepted: "PLAN_PENDING",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  PLAN_PENDING: {
    plan_valid: "EVIDENCE_PENDING",
    plan_invalid: "BLOCKED",
    retry_budget_exhausted: "PAUSED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  EVIDENCE_PENDING: {
    evidence_returned: "EVIDENCE_ASSESSED",
    retry_budget_exhausted: "PAUSED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  EVIDENCE_ASSESSED: {
    claims_supported: "ACTION_PENDING",
    claim_blocked: "BLOCKED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  ACTION_PENDING: {
    action_proposed: "POLICY_PENDING",
    duplicate_action_intent: "CONFLICT",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  POLICY_PENDING: {
    policy_requires_approval: "APPROVAL_PENDING",
    policy_allow: "EXECUTION_PENDING",
    policy_deny: "BLOCKED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  APPROVAL_PENDING: {
    approval_matched: "EXECUTION_PENDING",
    approval_snapshot_changed: "CONFLICT",
    approval_rejected: "BLOCKED",
    approval_expired: "PAUSED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  EXECUTION_PENDING: {
    execution_resolved: "VERIFICATION_PENDING",
    execution_unknown_outcome: "RECONCILIATION_REQUIRED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  VERIFICATION_PENDING: {
    postcondition_pass: "COMPLETE",
    postcondition_fail: "FAILED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  RECONCILIATION_REQUIRED: {
    reconciliation_found: "VERIFICATION_PENDING",
    reconciliation_inconclusive: "RECONCILIATION_REQUIRED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  // Terminal in this gate: COMPLETE, FAILED are true end states of the
  // frozen diagram; BLOCKED, PAUSED, CONFLICT are terminal-FOR-THIS-MACHINE
  // (see module doc comment) pending a later gate's explicit recovery design.
  COMPLETE: {},
  BLOCKED: {},
  PAUSED: {},
  CONFLICT: {},
  FAILED: {},
};

export type TransitionResult =
  | { readonly ok: true; readonly nextState: WorkflowState }
  | { readonly ok: false; readonly reasonCode: "ILLEGAL_TRANSITION" };

/**
 * Apply one trigger to one state. Any (state, trigger) pair not present in
 * `TRANSITION_TABLE` is illegal and rejected — there is no default/fallback
 * transition, so an unrecognized trigger (including one a compromised or
 * confused agent might attempt) can never silently advance a workflow.
 */
export function transition(current: WorkflowState, trigger: WorkflowStateTrigger): TransitionResult {
  const nextState = TRANSITION_TABLE[current][trigger];
  if (nextState === undefined) {
    return { ok: false, reasonCode: "ILLEGAL_TRANSITION" };
  }
  return { ok: true, nextState };
}

/** A state with no outgoing transitions in the table. */
export function isTerminal(state: WorkflowState): boolean {
  return Object.keys(TRANSITION_TABLE[state]).length === 0;
}

/** The triggers legally available from a given state — for UI "safe next action" surfaces (`UX_SPEC.md`) and for tests enumerating exactly what a state permits. */
export function availableTriggers(state: WorkflowState): readonly WorkflowStateTrigger[] {
  return Object.keys(TRANSITION_TABLE[state]) as WorkflowStateTrigger[];
}

/** The workflow's starting state — always `INTAKE`, never constructed any other way. */
export const INITIAL_STATE: WorkflowState = "INTAKE";
