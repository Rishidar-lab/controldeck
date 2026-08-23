import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { consumeApproval, grantApproval } from "./grant.js";
import { evaluateAuthority, matchApproval } from "./match.js";
import type { Approval, ApprovalBinding, ApprovalConsumptionContext } from "./types.js";

const BINDING: ApprovalBinding = { workflowId: "wf_1", planHash: "h_plan_1", evidenceSnapshotId: "snap_1", actionHash: "h_action_1", policyVersion: "policy-v1" };

const GRANTED_AT = new Date("2026-08-23T00:00:00.000Z");

function grant(binding: ApprovalBinding = BINDING): Approval {
  const clock = new FixedClock(GRANTED_AT);
  return grantApproval({ binding, grantedByPrincipal: "human_1" }, clock, new CounterIdGenerator());
}

function contextMatching(binding: ApprovalBinding = BINDING, at: Date = new Date("2026-08-23T00:01:00.000Z")): ApprovalConsumptionContext {
  return { workflowId: binding.workflowId, planHash: binding.planHash, evidenceSnapshotId: binding.evidenceSnapshotId, actionHash: binding.actionHash, policyVersion: binding.policyVersion, now: at };
}

describe("Gate 5 test 1 — valid exact approval accepted", () => {
  it("an approval consumed against the exact snapshot it was granted for matches", () => {
    const approval = grant();
    expect(matchApproval(approval, contextMatching())).toEqual({ ok: true });
    expect(evaluateAuthority(approval, contextMatching())).toEqual({ ok: true });
  });
});

describe("Gate 5 test 2 — missing approval -> no authority", () => {
  it("evaluateAuthority(undefined, ...) is never ok:true", () => {
    expect(evaluateAuthority(undefined, contextMatching())).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED"] });
  });
});

describe("Gate 5 test 3 — expired approval rejected", () => {
  it("consumption 10 minutes and 1ms after grant is past the TTL -> APPROVAL_EXPIRED", () => {
    const approval = grant();
    const justPastExpiry = new Date(GRANTED_AT.getTime() + 10 * 60 * 1000 + 1);
    expect(matchApproval(approval, contextMatching(BINDING, justPastExpiry))).toEqual({ ok: false, reasonCodes: ["APPROVAL_EXPIRED"] });
  });

  it("consumption exactly at the TTL boundary still matches (expiresAt is inclusive)", () => {
    const approval = grant();
    const exactlyAtExpiry = new Date(GRANTED_AT.getTime() + 10 * 60 * 1000);
    expect(matchApproval(approval, contextMatching(BINDING, exactlyAtExpiry))).toEqual({ ok: true });
  });

  it("a corrupted/unparseable expiresAt fails CLOSED as expired, never as valid", () => {
    const approval: Approval = { ...grant(), expiresAt: "not-a-date" };
    expect(matchApproval(approval, contextMatching())).toEqual({ ok: false, reasonCodes: ["APPROVAL_EXPIRED"] });
  });
});

describe("Gate 5 test 4 — consumed approval rejected (single-use)", () => {
  it("an approval already carrying consumedAt never matches again, even against its own exact original binding", () => {
    const clock = new FixedClock(GRANTED_AT);
    const approval = grant();
    const consumed = consumeApproval(approval, clock);
    expect(matchApproval(consumed, contextMatching())).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED"] });
  });
});

describe("Gate 5 test 5 — approval for a different action rejected", () => {
  it("actionHash mismatch (different action id folded into the hash) -> APPROVAL_INVALIDATED", () => {
    const approval = grant();
    const context = contextMatching(BINDING);
    expect(matchApproval(approval, { ...context, actionHash: "h_action_DIFFERENT" })).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED"] });
  });
});

describe("Gate 5 test 6 — approval for a different resource rejected", () => {
  it("a resource change is just another actionHash mismatch (hashAction folds resourceId in — see binding.test.ts) -> APPROVAL_INVALIDATED", () => {
    const approval = grant();
    expect(matchApproval(approval, { ...contextMatching(), actionHash: "h_action_for_different_resource" })).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED"] });
  });
});

describe("Gate 5 test 7 — changed parameters rejected", () => {
  it("a parameter change is likewise an actionHash mismatch (hashAction folds parameters in — see binding.test.ts) -> APPROVAL_INVALIDATED", () => {
    const approval = grant();
    expect(matchApproval(approval, { ...contextMatching(), actionHash: "h_action_with_different_parameters" })).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED"] });
  });
});

describe("Gate 5 test 8 — changed evidence snapshot rejected", () => {
  it("evidenceSnapshotId mismatch -> SNAPSHOT_CHANGED alone (w4-022/w4-025 exact shape)", () => {
    const approval = grant();
    expect(matchApproval(approval, { ...contextMatching(), evidenceSnapshotId: "snap_2" })).toEqual({ ok: false, reasonCodes: ["SNAPSHOT_CHANGED"] });
  });
});

describe("Gate 5 test 9 — changed governance outcome rejected", () => {
  it("policyVersion mismatch (the policy that produced REQUIRE_APPROVAL is no longer current) -> APPROVAL_INVALIDATED", () => {
    const approval = grant();
    expect(matchApproval(approval, { ...contextMatching(), policyVersion: "policy-v2" })).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED"] });
  });
});

describe("Gate 5 test 10 — stale workflow version rejected", () => {
  it("by the time of consumption every dimension has moved on (plan, evidence, action, policy all advanced together) — still rejected, not just individually but as a whole 'new version' of the workflow", () => {
    const approval = grant();
    const advancedContext: ApprovalConsumptionContext = {
      workflowId: BINDING.workflowId, // same workflow id — this is NOT the cross-workflow-reuse case (test 12)
      planHash: "h_plan_2",
      evidenceSnapshotId: "snap_2",
      actionHash: "h_action_2",
      policyVersion: "policy-v2",
      now: new Date("2026-08-23T00:05:00.000Z"),
    };
    const result = matchApproval(approval, advancedContext);
    expect(result.ok).toBe(false);
    // planHash is checked first among the snapshot dimensions, so it dominates the reported codes.
    expect(result).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED", "SNAPSHOT_CHANGED"] });
  });
});

describe("Gate 5 test 11 — agent-generated approval rejected", () => {
  it("grantApproval is the only function in this codebase that can produce an Approval; @controldeck/agents' PlannerOutcome/ResearcherOutcome and @controldeck/governance's GovernanceDecision have no approvalId/binding/grantedByPrincipal fields to even begin satisfying the type (TypeScript rejects the assignment; verified by `pnpm -r typecheck`, not a runtime check)", () => {
    // A forged, hand-built object standing in for 'an agent fabricated an
    // approval-shaped object' — the only way it could ever match is by
    // already knowing the real current binding, which nothing an agent
    // produces (Gate 4's strictly-validated output, Gate 3's
    // GovernanceDecision) ever carries or exposes.
    const forged: Approval = {
      approvalId: "approval_forged_by_agent",
      binding: { workflowId: "wf_1", planHash: "guessed_hash", evidenceSnapshotId: "snap_1", actionHash: "h_action_1", policyVersion: "policy-v1" },
      grantedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      grantedByPrincipal: "planner-agent-1",
    };
    expect(matchApproval(forged, contextMatching())).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED", "SNAPSHOT_CHANGED"] });
  });
});

describe("Gate 5 test 12 — copied approval from another workflow rejected", () => {
  it("workflowId mismatch (every other dimension identical) -> APPROVAL_INVALIDATED", () => {
    const approval = grant({ ...BINDING, workflowId: "wf_OTHER" });
    expect(matchApproval(approval, contextMatching())).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED"] });
  });
});

describe("approval race / TOCTOU: state changes after approval, before consumption", () => {
  it("approval granted against snapshot A; by the time authority is consumed the workflow's real plan hash has moved to B -> STALE/INVALID, NO AUTHORITY (mirrors w4-006's exact shape)", () => {
    const approval = grant({ ...BINDING, planHash: "h_plan_A" });
    const currentContext = contextMatching({ ...BINDING, planHash: "h_plan_B" });
    const result = evaluateAuthority(approval, currentContext);
    expect(result).toEqual({ ok: false, reasonCodes: ["APPROVAL_INVALIDATED", "SNAPSHOT_CHANGED"] });
  });
});
