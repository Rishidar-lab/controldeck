import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { consumeApproval, grantApproval } from "./grant.js";
import type { ApprovalBinding } from "./types.js";

const BINDING: ApprovalBinding = { workflowId: "wf_1", planHash: "h_plan", evidenceSnapshotId: "snap_1", actionHash: "h_action", policyVersion: "policy-v1" };

describe("grantApproval", () => {
  it("binds exactly the input binding, unmodified", () => {
    const clock = new FixedClock(new Date("2026-08-23T00:00:00.000Z"));
    const approval = grantApproval({ binding: BINDING, grantedByPrincipal: "human_1" }, clock, new CounterIdGenerator());
    expect(approval.binding).toEqual(BINDING);
    expect(approval.grantedByPrincipal).toBe("human_1");
    expect(approval.consumedAt).toBeUndefined();
  });

  it("sets a 10-minute expiry from the clock's current instant (AGENT_CONTRACTS.md: 'TTL 10m')", () => {
    const clock = new FixedClock(new Date("2026-08-23T00:00:00.000Z"));
    const approval = grantApproval({ binding: BINDING, grantedByPrincipal: "human_1" }, clock, new CounterIdGenerator());
    expect(approval.grantedAt).toBe("2026-08-23T00:00:00.000Z");
    expect(approval.expiresAt).toBe("2026-08-23T00:10:00.000Z");
  });

  it("mints a deterministic id through the supplied IdGenerator, never crypto.randomUUID directly", () => {
    const clock = new FixedClock(new Date("2026-08-23T00:00:00.000Z"));
    const ids = new CounterIdGenerator();
    const first = grantApproval({ binding: BINDING, grantedByPrincipal: "human_1" }, clock, ids);
    const second = grantApproval({ binding: BINDING, grantedByPrincipal: "human_1" }, clock, ids);
    expect(first.approvalId).toBe("approval_000001");
    expect(second.approvalId).toBe("approval_000002");
  });
});

describe("consumeApproval", () => {
  it("returns a new record with consumedAt set, leaving the original untouched", () => {
    const clock = new FixedClock(new Date("2026-08-23T00:00:00.000Z"));
    const approval = grantApproval({ binding: BINDING, grantedByPrincipal: "human_1" }, clock, new CounterIdGenerator());
    clock.advanceMs(60_000);
    const consumed = consumeApproval(approval, clock);
    expect(approval.consumedAt).toBeUndefined();
    expect(consumed.consumedAt).toBe("2026-08-23T00:01:00.000Z");
    expect(consumed.binding).toEqual(approval.binding);
  });
});
