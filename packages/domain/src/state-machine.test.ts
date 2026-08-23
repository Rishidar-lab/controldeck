import type { WorkflowState, WorkflowStateTrigger } from "@controldeck/contracts";
import { describe, expect, it } from "vitest";
import { availableTriggers, INITIAL_STATE, isTerminal, transition } from "./state-machine.js";

/**
 * One assertion per row of submission/week4/ARCHITECTURE.md's 27-row
 * per-transition table (row 27, replay, is a read-only projection, not a
 * state transition, and is intentionally excluded here). Every FROM/TO/
 * TRIGGER triple below is copied directly from that table, not invented
 * for the test.
 */
describe("transition — every legal (state, trigger) -> state pair", () => {
  it.each<readonly [WorkflowState, WorkflowStateTrigger, WorkflowState]>([
    ["INTAKE", "intake_accepted", "PLAN_PENDING"],
    ["PLAN_PENDING", "plan_valid", "EVIDENCE_PENDING"],
    ["PLAN_PENDING", "plan_invalid", "BLOCKED"],
    ["EVIDENCE_PENDING", "evidence_returned", "EVIDENCE_ASSESSED"],
    ["EVIDENCE_PENDING", "retry_budget_exhausted", "PAUSED"],
    ["EVIDENCE_ASSESSED", "claims_supported", "ACTION_PENDING"],
    ["EVIDENCE_ASSESSED", "claim_blocked", "BLOCKED"],
    ["ACTION_PENDING", "action_proposed", "POLICY_PENDING"],
    ["ACTION_PENDING", "duplicate_action_intent", "CONFLICT"],
    ["POLICY_PENDING", "policy_requires_approval", "APPROVAL_PENDING"],
    ["POLICY_PENDING", "policy_allow", "EXECUTION_PENDING"],
    ["POLICY_PENDING", "policy_deny", "BLOCKED"],
    ["APPROVAL_PENDING", "approval_matched", "EXECUTION_PENDING"],
    ["APPROVAL_PENDING", "approval_snapshot_changed", "CONFLICT"],
    ["APPROVAL_PENDING", "approval_rejected", "BLOCKED"],
    ["APPROVAL_PENDING", "approval_expired", "PAUSED"],
    ["EXECUTION_PENDING", "execution_resolved", "VERIFICATION_PENDING"],
    ["EXECUTION_PENDING", "execution_unknown_outcome", "RECONCILIATION_REQUIRED"],
    ["VERIFICATION_PENDING", "postcondition_pass", "COMPLETE"],
    ["VERIFICATION_PENDING", "postcondition_fail", "FAILED"],
    ["RECONCILIATION_REQUIRED", "reconciliation_found", "VERIFICATION_PENDING"],
    ["RECONCILIATION_REQUIRED", "reconciliation_inconclusive", "RECONCILIATION_REQUIRED"],
    // Cross-cutting rows 24-26, one representative state each plus a second to prove it's not a one-off:
    ["PLAN_PENDING", "audit_integrity_failed", "PAUSED"],
    ["EXECUTION_PENDING", "audit_integrity_failed", "PAUSED"],
    ["EVIDENCE_ASSESSED", "model_authority_violation", "BLOCKED"],
    ["APPROVAL_PENDING", "model_authority_violation", "BLOCKED"],
    // Gate 7: retry_budget_exhausted extended to every retryable pending
    // state (ARCHITECTURE.md row 24, w4-021) beyond Gate 1's original
    // PLAN_PENDING/EVIDENCE_PENDING pair — one representative sample here,
    // full coverage in the dedicated Gate 7 describe block below.
    ["EVIDENCE_ASSESSED", "retry_budget_exhausted", "PAUSED"],
    ["ACTION_PENDING", "retry_budget_exhausted", "PAUSED"],
    ["POLICY_PENDING", "retry_budget_exhausted", "PAUSED"],
    ["EXECUTION_PENDING", "retry_budget_exhausted", "PAUSED"],
    ["VERIFICATION_PENDING", "retry_budget_exhausted", "PAUSED"],
    ["RECONCILIATION_REQUIRED", "retry_budget_exhausted", "PAUSED"],
  ])("%s --%s--> %s", (from, trigger, expectedTo) => {
    expect(transition(from, trigger)).toEqual({ ok: true, nextState: expectedTo });
  });
});

describe("transition — illegal pairs fail closed", () => {
  it.each<readonly [WorkflowState, WorkflowStateTrigger]>([
    ["INTAKE", "postcondition_pass"],
    ["COMPLETE", "intake_accepted"],
    ["BLOCKED", "plan_valid"],
    ["PLAN_PENDING", "approval_matched"],
    ["VERIFICATION_PENDING", "duplicate_action_intent"],
    // Gate 7 extended retry_budget_exhausted to every retryable pending
    // state, but deliberately NOT to these two (state-machine.ts's own
    // doc comment): INTAKE has nothing to retry, and APPROVAL_PENDING
    // already has its own more specific exhaustion trigger
    // (approval_expired) — asserting the generic one is still illegal
    // there is itself a real behavioral claim, not filler.
    ["INTAKE", "retry_budget_exhausted"],
    ["APPROVAL_PENDING", "retry_budget_exhausted"],
  ])("%s --%s--> ILLEGAL_TRANSITION", (from, trigger) => {
    expect(transition(from, trigger)).toEqual({ ok: false, reasonCode: "ILLEGAL_TRANSITION" });
  });
});

describe("isTerminal", () => {
  it.each<WorkflowState>(["COMPLETE", "FAILED", "BLOCKED", "PAUSED", "CONFLICT"])("%s is terminal", (state) => {
    expect(isTerminal(state)).toBe(true);
  });

  it.each<WorkflowState>([
    "INTAKE",
    "PLAN_PENDING",
    "EVIDENCE_PENDING",
    "EVIDENCE_ASSESSED",
    "ACTION_PENDING",
    "POLICY_PENDING",
    "APPROVAL_PENDING",
    "EXECUTION_PENDING",
    "VERIFICATION_PENDING",
    "RECONCILIATION_REQUIRED",
  ])("%s is NOT terminal", (state) => {
    expect(isTerminal(state)).toBe(false);
  });
});

describe("availableTriggers", () => {
  it("POLICY_PENDING allows exactly the 3 policy outcomes plus retry_budget_exhausted plus the 2 cross-cutting triggers", () => {
    expect(new Set(availableTriggers("POLICY_PENDING"))).toEqual(
      new Set(["policy_requires_approval", "policy_allow", "policy_deny", "retry_budget_exhausted", "audit_integrity_failed", "model_authority_violation"]),
    );
  });

  it("a terminal state has no available triggers", () => {
    expect(availableTriggers("COMPLETE")).toEqual([]);
  });

  it("every non-terminal state except INTAKE and APPROVAL_PENDING includes retry_budget_exhausted (Gate 7)", () => {
    const withBudget: readonly WorkflowState[] = ["PLAN_PENDING", "EVIDENCE_PENDING", "EVIDENCE_ASSESSED", "ACTION_PENDING", "POLICY_PENDING", "EXECUTION_PENDING", "VERIFICATION_PENDING", "RECONCILIATION_REQUIRED"];
    for (const state of withBudget) {
      expect(availableTriggers(state)).toContain("retry_budget_exhausted");
    }
    expect(availableTriggers("INTAKE")).not.toContain("retry_budget_exhausted");
    expect(availableTriggers("APPROVAL_PENDING")).not.toContain("retry_budget_exhausted");
  });
});

describe("INITIAL_STATE", () => {
  it("is INTAKE", () => {
    expect(INITIAL_STATE).toBe("INTAKE");
  });
});
