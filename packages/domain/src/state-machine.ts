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
 * state. Nothing is built via a dynamic "any state" shortcut: every legal
 * (state, trigger) pair is a literal entry you can read and audit
 * directly, matching ActionHarbor's own `state-machine.ts` discipline.
 *
 * `retry_budget_exhausted` (Gate 7 reconciliation, `submission/week4/
 * ARCHITECTURE.md` row 24: "any pending state -> PAUSED ... cross-cutting,
 * justified by w4-021") is repeated on every non-terminal state EXCEPT
 * two, each excluded for a stated reason rather than by oversight:
 * `INTAKE` (a near-instantaneous acceptance step with nothing to retry —
 * Gate 1's original design already left it off, and nothing since has
 * given it a retry budget) and `APPROVAL_PENDING` (already has its own
 * more specific exhaustion trigger, `approval_expired`, serving the same
 * "given up waiting" role for that state — adding a second, generic
 * cross-cutting exhaustion trigger there would be redundant with, and
 * potentially ambiguous against, the one the frozen TTL already defines).
 * `PLAN_PENDING`/`EVIDENCE_PENDING` had this trigger from Gate 1 already
 * (the Planner's and Researcher's own per-agent retry budgets,
 * `AGENT_CONTRACTS.md`); this gate extends it to every other retryable
 * pending state so `w4-021` ("Unbounded retry attempt") composes with
 * the real state machine regardless of which stage the exhausted retry
 * budget belongs to.
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
    retry_budget_exhausted: "PAUSED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  ACTION_PENDING: {
    action_proposed: "POLICY_PENDING",
    duplicate_action_intent: "CONFLICT",
    retry_budget_exhausted: "PAUSED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  POLICY_PENDING: {
    policy_requires_approval: "APPROVAL_PENDING",
    policy_allow: "EXECUTION_PENDING",
    policy_deny: "BLOCKED",
    retry_budget_exhausted: "PAUSED",
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
    retry_budget_exhausted: "PAUSED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  VERIFICATION_PENDING: {
    postcondition_pass: "COMPLETE",
    postcondition_fail: "FAILED",
    retry_budget_exhausted: "PAUSED",
    audit_integrity_failed: "PAUSED",
    model_authority_violation: "BLOCKED",
  },
  RECONCILIATION_REQUIRED: {
    reconciliation_found: "VERIFICATION_PENDING",
    reconciliation_inconclusive: "RECONCILIATION_REQUIRED",
    retry_budget_exhausted: "PAUSED",
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
