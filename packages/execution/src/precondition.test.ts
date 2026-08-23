import { describe, expect, it } from "vitest";
import type { Capability } from "./capability.js";
import type { CurrentExecutionState } from "./precondition.js";
import { checkExecutionPreconditions } from "./precondition.js";

function capability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: "cap_1",
    nonce: "nonce_1",
    principalRole: "operator",
    tenantId: "t1",
    actionType: "create_internal_ticket",
    resourceId: "res_1",
    workflowId: "wf_1",
    planHash: "h_plan_1",
    evidenceSnapshotId: "snap_1",
    actionHash: "h_action_1",
    policyVersion: "policy-v1",
    expectedResourceVersion: 1,
    expiresAt: "2026-08-23T00:05:00.000Z",
    status: "active",
    ...overrides,
  };
}

function current(overrides: Partial<CurrentExecutionState> = {}): CurrentExecutionState {
  return { resourceVersion: 1, evidenceSnapshotId: "snap_1", planHash: "h_plan_1", actionHash: "h_action_1", policyVersion: "policy-v1", ...overrides };
}

describe("checkExecutionPreconditions — no drift", () => {
  it("everything matching passes", () => {
    expect(checkExecutionPreconditions(capability(), current())).toEqual({ ok: true });
  });
});

describe("checkExecutionPreconditions — state drift (Gate 6 examples: resource version, evidence snapshot, action parameters, plan/governance)", () => {
  it("resource version changed since the capability was minted (w4-007 shape)", () => {
    const result = checkExecutionPreconditions(capability(), current({ resourceVersion: 2 }));
    expect(result).toEqual({ ok: false, reasonCode: "PRECONDITION_FAILED", driftedDimensions: ["RESOURCE_VERSION"] });
  });

  it("evidence snapshot changed", () => {
    expect(checkExecutionPreconditions(capability(), current({ evidenceSnapshotId: "snap_2" }))).toEqual({ ok: false, reasonCode: "PRECONDITION_FAILED", driftedDimensions: ["EVIDENCE_SNAPSHOT"] });
  });

  it("plan changed", () => {
    expect(checkExecutionPreconditions(capability(), current({ planHash: "h_plan_2" }))).toEqual({ ok: false, reasonCode: "PRECONDITION_FAILED", driftedDimensions: ["PLAN"] });
  });

  it("action (parameters/resource/type) changed", () => {
    expect(checkExecutionPreconditions(capability(), current({ actionHash: "h_action_2" }))).toEqual({ ok: false, reasonCode: "PRECONDITION_FAILED", driftedDimensions: ["ACTION"] });
  });

  it("governance decision (policy) changed", () => {
    expect(checkExecutionPreconditions(capability(), current({ policyVersion: "policy-v2" }))).toEqual({ ok: false, reasonCode: "PRECONDITION_FAILED", driftedDimensions: ["POLICY_VERSION"] });
  });

  it("multiple dimensions drifting at once are ALL reported, not just the first", () => {
    const result = checkExecutionPreconditions(capability(), current({ resourceVersion: 2, evidenceSnapshotId: "snap_2", policyVersion: "policy-v2" }));
    expect(result).toEqual({ ok: false, reasonCode: "PRECONDITION_FAILED", driftedDimensions: ["EVIDENCE_SNAPSHOT", "POLICY_VERSION", "RESOURCE_VERSION"] });
  });
});
