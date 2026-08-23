import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import type { GovernanceDecision } from "@controldeck/governance";
import type { Approval } from "@controldeck/authority";
import { describe, expect, it } from "vitest";
import type { Capability, CapabilityRequest } from "./capability.js";
import { MAX_CAPABILITY_TTL_MS, mintCapability, validateCapability } from "./capability.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");

function request(overrides: Partial<CapabilityRequest> = {}): CapabilityRequest {
  return {
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
    ...overrides,
  };
}

function allowDecision(overrides: Partial<GovernanceDecision> = {}): GovernanceDecision {
  return { outcome: "ALLOW", reasonCodes: [], policyVersion: "policy-v1", ...overrides };
}

function consumedApproval(overrides: Partial<Approval["binding"]> = {}): Approval {
  return {
    approvalId: "appr_1",
    binding: { workflowId: "wf_1", planHash: "h_plan_1", evidenceSnapshotId: "snap_1", actionHash: "h_action_1", policyVersion: "policy-v1", ...overrides },
    grantedAt: "2026-08-23T00:00:00.000Z",
    expiresAt: "2026-08-23T00:10:00.000Z",
    grantedByPrincipal: "human_1",
    consumedAt: "2026-08-23T00:00:30.000Z",
  };
}

describe("mintCapability — policy-allow evidence", () => {
  it("mints a capability bound to exactly the request's fields", () => {
    const clock = new FixedClock(NOW);
    const result = mintCapability({ kind: "policy-allow", decision: allowDecision() }, request(), new CounterIdGenerator(), clock, 60_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.capability).toMatchObject({ ...request(), status: "active" });
    expect(result.capability.expiresAt).toBe("2026-08-23T00:01:00.000Z");
  });

  it("a DENY/REQUIRE_APPROVAL decision cannot mint a capability -> POLICY_DID_NOT_ALLOW", () => {
    const clock = new FixedClock(NOW);
    const deny = mintCapability({ kind: "policy-allow", decision: allowDecision({ outcome: "DENY", reasonCodes: ["FORBIDDEN_TOOL"] }) }, request(), new CounterIdGenerator(), clock, 60_000);
    expect(deny).toEqual({ ok: false, reasonCode: "POLICY_DID_NOT_ALLOW" });
    const requireApproval = mintCapability({ kind: "policy-allow", decision: allowDecision({ outcome: "REQUIRE_APPROVAL", reasonCodes: ["CUMULATIVE_RISK_REQUIRES_APPROVAL"] }) }, request(), new CounterIdGenerator(), clock, 60_000);
    expect(requireApproval).toEqual({ ok: false, reasonCode: "POLICY_DID_NOT_ALLOW" });
  });

  it("a stale policyVersion on the decision is rejected even if outcome is ALLOW -> POLICY_VERSION_MISMATCH", () => {
    const clock = new FixedClock(NOW);
    const result = mintCapability({ kind: "policy-allow", decision: allowDecision({ policyVersion: "policy-v0-STALE" }) }, request(), new CounterIdGenerator(), clock, 60_000);
    expect(result).toEqual({ ok: false, reasonCode: "POLICY_VERSION_MISMATCH" });
  });

  it("caps ttlMs at MAX_CAPABILITY_TTL_MS regardless of what the caller requests", () => {
    const clock = new FixedClock(NOW);
    const result = mintCapability({ kind: "policy-allow", decision: allowDecision() }, request(), new CounterIdGenerator(), clock, 999_999_999);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Date(result.capability.expiresAt).getTime() - NOW.getTime()).toBe(MAX_CAPABILITY_TTL_MS);
  });
});

describe("mintCapability — consumed-approval evidence", () => {
  it("mints a capability from a genuinely consumed approval whose binding matches the request", () => {
    const clock = new FixedClock(NOW);
    const result = mintCapability({ kind: "approved", approval: consumedApproval() }, request(), new CounterIdGenerator(), clock, 60_000);
    expect(result.ok).toBe(true);
  });

  it("an approval that was never consumed cannot mint a capability -> APPROVAL_NOT_CONSUMED (an agent's own claim of approval has no consumedAt to point to)", () => {
    const clock = new FixedClock(NOW);
    const { consumedAt: _consumedAt, ...withoutConsumedAt } = consumedApproval();
    const unconsumed: Approval = withoutConsumedAt;
    const result = mintCapability({ kind: "approved", approval: unconsumed }, request(), new CounterIdGenerator(), clock, 60_000);
    expect(result).toEqual({ ok: false, reasonCode: "APPROVAL_NOT_CONSUMED" });
  });

  it("an approval whose binding does not match the request -> APPROVAL_SCOPE_MISMATCH (plan changed, evidence changed, action changed, or policy changed)", () => {
    const clock = new FixedClock(NOW);
    expect(mintCapability({ kind: "approved", approval: consumedApproval({ planHash: "h_plan_OTHER" }) }, request(), new CounterIdGenerator(), clock, 60_000)).toEqual({ ok: false, reasonCode: "APPROVAL_SCOPE_MISMATCH" });
    expect(mintCapability({ kind: "approved", approval: consumedApproval({ evidenceSnapshotId: "snap_OTHER" }) }, request(), new CounterIdGenerator(), clock, 60_000)).toEqual({ ok: false, reasonCode: "APPROVAL_SCOPE_MISMATCH" });
    expect(mintCapability({ kind: "approved", approval: consumedApproval({ actionHash: "h_action_OTHER" }) }, request(), new CounterIdGenerator(), clock, 60_000)).toEqual({ ok: false, reasonCode: "APPROVAL_SCOPE_MISMATCH" });
    expect(mintCapability({ kind: "approved", approval: consumedApproval({ policyVersion: "policy-v2" }) }, request(), new CounterIdGenerator(), clock, 60_000)).toEqual({ ok: false, reasonCode: "APPROVAL_SCOPE_MISMATCH" });
  });
});

function capability(overrides: Partial<Capability> = {}): Capability {
  return { id: "cap_1", nonce: "nonce_1", ...request(), expiresAt: "2026-08-23T00:05:00.000Z", status: "active", ...overrides };
}

describe("validateCapability — scope/status/expiry", () => {
  it("a matching, active, unexpired capability validates", () => {
    expect(validateCapability(capability(), request(), NOW)).toEqual({ ok: true });
  });

  it("an already-consumed capability is rejected -> CAPABILITY_ALREADY_CONSUMED", () => {
    expect(validateCapability(capability({ status: "consumed" }), request(), NOW)).toEqual({ ok: false, reasonCode: "CAPABILITY_ALREADY_CONSUMED" });
  });

  it("an expired capability is rejected -> CAPABILITY_EXPIRED", () => {
    const past = new Date(NOW.getTime() + 10 * 60 * 1000);
    expect(validateCapability(capability(), request(), past)).toEqual({ ok: false, reasonCode: "CAPABILITY_EXPIRED" });
  });

  it("a corrupted expiresAt fails CLOSED as expired, never as valid", () => {
    expect(validateCapability(capability({ expiresAt: "not-a-date" }), request(), NOW)).toEqual({ ok: false, reasonCode: "CAPABILITY_EXPIRED" });
  });

  it("every scope dimension is independently checked — a mismatch on any one is CAPABILITY_SCOPE_MISMATCH", () => {
    expect(validateCapability(capability(), request({ resourceId: "res_OTHER" }), NOW)).toEqual({ ok: false, reasonCode: "CAPABILITY_SCOPE_MISMATCH" });
    expect(validateCapability(capability(), request({ actionType: "issue_refund" }), NOW)).toEqual({ ok: false, reasonCode: "CAPABILITY_SCOPE_MISMATCH" });
    expect(validateCapability(capability(), request({ tenantId: "t2" }), NOW)).toEqual({ ok: false, reasonCode: "CAPABILITY_SCOPE_MISMATCH" });
    expect(validateCapability(capability(), request({ workflowId: "wf_OTHER" }), NOW)).toEqual({ ok: false, reasonCode: "CAPABILITY_SCOPE_MISMATCH" });
    expect(validateCapability(capability(), request({ expectedResourceVersion: 99 }), NOW)).toEqual({ ok: false, reasonCode: "CAPABILITY_SCOPE_MISMATCH" });
  });
});
