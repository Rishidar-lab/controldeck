import type { PlanArtifact } from "@controldeck/contracts";
import { describe, expect, it } from "vitest";
import { hashAction, hashPlan, type ActionSnapshot } from "./binding.js";

const PLAN: PlanArtifact = { planId: "plan_1", goal: "refund order 42", steps: [{ stepId: "s1", description: "verify eligibility", dependsOn: [] }] };

const ACTION: ActionSnapshot = { actionId: "a1", actionType: "issue_refund", resourceId: "order_42", principalRole: "operator", tenantId: "t1", parameters: { amountMinor: 500 } };

describe("hashPlan / hashAction — deterministic, sensitive to every field", () => {
  it("the same plan hashes identically every time", () => {
    expect(hashPlan(PLAN)).toBe(hashPlan(PLAN));
  });

  it("a different step description changes the hash", () => {
    const changed: PlanArtifact = { ...PLAN, steps: [{ ...PLAN.steps[0]!, description: "verify eligibility twice" }] };
    expect(hashPlan(changed)).not.toBe(hashPlan(PLAN));
  });

  it("the same action hashes identically every time", () => {
    expect(hashAction(ACTION)).toBe(hashAction(ACTION));
  });

  it("a changed resourceId changes the action hash (Gate 5 test 6: different resource)", () => {
    expect(hashAction({ ...ACTION, resourceId: "order_43" })).not.toBe(hashAction(ACTION));
  });

  it("a changed actionId changes the action hash (Gate 5 test 5: different action)", () => {
    expect(hashAction({ ...ACTION, actionId: "a2" })).not.toBe(hashAction(ACTION));
  });

  it("a changed parameter value changes the action hash (Gate 5 test 7: changed parameters)", () => {
    expect(hashAction({ ...ACTION, parameters: { amountMinor: 999 } })).not.toBe(hashAction(ACTION));
  });
});
