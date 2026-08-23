import { CounterIdGenerator } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import type { Capability } from "./capability.js";
import { CapabilityRegistry } from "./registry.js";

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

describe("CapabilityRegistry.consume", () => {
  it("an unrecorded capability id -> CAPABILITY_UNKNOWN, even with a well-formed nonce (mints authority cannot be forged by inventing an id)", () => {
    const registry = new CapabilityRegistry();
    expect(registry.consume("cap_never_recorded", "nonce_1", new CounterIdGenerator())).toEqual({ ok: false, reasonCode: "CAPABILITY_UNKNOWN" });
  });

  it("a recorded capability with the wrong nonce -> CAPABILITY_NONCE_MISMATCH", () => {
    const registry = new CapabilityRegistry();
    registry.record(capability());
    expect(registry.consume("cap_1", "wrong_nonce", new CounterIdGenerator())).toEqual({ ok: false, reasonCode: "CAPABILITY_NONCE_MISMATCH" });
  });

  it("a genuinely recorded, correct capability+nonce consumes successfully and returns a ticket", () => {
    const registry = new CapabilityRegistry();
    registry.record(capability());
    const result = registry.consume("cap_1", "nonce_1", new CounterIdGenerator());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ticket.capabilityId).toBe("cap_1");
  });

  it("consuming the same capability twice -> CAPABILITY_ALREADY_CONSUMED the second time (single-use)", () => {
    const registry = new CapabilityRegistry();
    registry.record(capability());
    const ids = new CounterIdGenerator();
    expect(registry.consume("cap_1", "nonce_1", ids).ok).toBe(true);
    expect(registry.consume("cap_1", "nonce_1", ids)).toEqual({ ok: false, reasonCode: "CAPABILITY_ALREADY_CONSUMED" });
  });
});

describe("CapabilityRegistry.verifyAndInvalidateTicket — the direct-adapter-bypass defence", () => {
  it("the exact ticket minted by consume() verifies", () => {
    const registry = new CapabilityRegistry();
    registry.record(capability());
    const result = registry.consume("cap_1", "nonce_1", new CounterIdGenerator());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(registry.verifyAndInvalidateTicket("cap_1", result.ticket.ticket)).toBe(true);
  });

  it("a hand-guessed/fabricated ticket string never verifies — there is no way to derive it from the capability's own public fields", () => {
    const registry = new CapabilityRegistry();
    registry.record(capability());
    registry.consume("cap_1", "nonce_1", new CounterIdGenerator());
    expect(registry.verifyAndInvalidateTicket("cap_1", "totally-made-up-ticket")).toBe(false);
    expect(registry.verifyAndInvalidateTicket("cap_1", "cap_1")).toBe(false); // guessing the capability's own id
    expect(registry.verifyAndInvalidateTicket("cap_1", "nonce_1")).toBe(false); // guessing the capability's own nonce
  });

  it("a capability that was never consumed at all has no valid ticket, ever", () => {
    const registry = new CapabilityRegistry();
    registry.record(capability());
    expect(registry.verifyAndInvalidateTicket("cap_1", "anything")).toBe(false);
  });

  it("a ticket is single-use even for verification itself — checking it once invalidates it for a second check", () => {
    const registry = new CapabilityRegistry();
    registry.record(capability());
    const result = registry.consume("cap_1", "nonce_1", new CounterIdGenerator());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(registry.verifyAndInvalidateTicket("cap_1", result.ticket.ticket)).toBe(true);
    expect(registry.verifyAndInvalidateTicket("cap_1", result.ticket.ticket)).toBe(false);
  });
});
