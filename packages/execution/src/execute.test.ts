import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import { transition } from "@controldeck/domain";
import type { GovernanceDecision } from "@controldeck/governance";
import { describe, expect, it, vi } from "vitest";
import type { Capability, CapabilityRequest } from "./capability.js";
import { mintCapability } from "./capability.js";
import type { CurrentExecutionState } from "./precondition.js";
import type { CreateTicketParams, TicketReceipt } from "./fake-ticket-adapter.js";
import { FakeTicketAdapter } from "./fake-ticket-adapter.js";
import { executeAction } from "./execute.js";
import { OperationStore } from "./operation-store.js";
import { CapabilityRegistry } from "./registry.js";

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

function current(overrides: Partial<CurrentExecutionState> = {}): CurrentExecutionState {
  return { resourceVersion: 1, evidenceSnapshotId: "snap_1", planHash: "h_plan_1", actionHash: "h_action_1", policyVersion: "policy-v1", ...overrides };
}

const ALLOW_DECISION: GovernanceDecision = { outcome: "ALLOW", reasonCodes: [], policyVersion: "policy-v1" };

function freshHarness() {
  const idGenerator = new CounterIdGenerator();
  const clock = new FixedClock(NOW);
  const registry = new CapabilityRegistry();
  const adapter = new FakeTicketAdapter(registry, idGenerator, clock);
  const operationStore = new OperationStore<TicketReceipt>();
  const mint = mintCapability({ kind: "policy-allow", decision: ALLOW_DECISION }, request(), idGenerator, clock, 60_000);
  if (!mint.ok) throw new Error("unreachable: mint should succeed in this harness");
  registry.record(mint.capability);
  return { idGenerator, clock, registry, adapter, operationStore, capability: mint.capability };
}

function baseParams(overrides: Partial<CreateTicketParams> = {}): CreateTicketParams {
  return { title: "customer reports delayed delivery", ...overrides };
}

describe("executeAction — authorized happy path", () => {
  it("mints -> consumes -> calls the adapter exactly once -> resolves with a receipt, composed with the real transition()", async () => {
    const h = freshHarness();
    const result = await executeAction({
      capability: h.capability,
      request: request(),
      registry: h.registry,
      operationStore: h.operationStore,
      adapter: h.adapter,
      operation: { operationId: "op_1", idempotencyKey: "idem_1" },
      params: baseParams(),
      clock: h.clock,
      idGenerator: h.idGenerator,
      current: current(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.trigger !== "execution_resolved") throw new Error("expected resolved");
    expect(result.receipt).toMatchObject({ status: "open", title: "customer reports delayed delivery" });
    expect(h.adapter.sideEffectCount).toBe(1);
    expect(transition("EXECUTION_PENDING", result.trigger)).toEqual({ ok: true, nextState: "VERIFICATION_PENDING" });
  });
});

describe("executeAction — authority cannot be forged, minted twice, or reused", () => {
  it("a capability that was never recorded in the registry is rejected before the adapter is ever consulted", async () => {
    const h = freshHarness();
    const forged: Capability = { ...h.capability, id: "cap_never_recorded" };
    const result = await executeAction({ capability: forged, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(result).toEqual({ ok: false, stage: "capability", reasonCode: "CAPABILITY_UNKNOWN" });
    expect(h.adapter.sideEffectCount).toBe(0);
  });

  it("presenting the SAME capability twice consumes it once and rejects the second — CAPABILITY_ALREADY_CONSUMED, not a second execution (different idempotency keys, so it is genuinely the capability being reused, not ordinary idempotent replay)", async () => {
    const h = freshHarness();
    const first = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(first.ok).toBe(true);

    const second = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_2", idempotencyKey: "idem_2" }, params: baseParams({ title: "a different ticket" }), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(second).toEqual({ ok: false, stage: "capability", reasonCode: "CAPABILITY_ALREADY_CONSUMED" });
    expect(h.adapter.sideEffectCount).toBe(1);
  });

  it("an expired capability cannot execute even though it was genuinely minted and recorded", async () => {
    const h = freshHarness();
    h.clock.set(new Date(NOW.getTime() + 61_000));
    const result = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(result).toEqual({ ok: false, stage: "capability", reasonCode: "CAPABILITY_EXPIRED" });
    expect(h.adapter.sideEffectCount).toBe(0);
  });

  it("a request for a different resource than the capability was minted for is rejected -> CAPABILITY_SCOPE_MISMATCH (substituting another resource)", async () => {
    const h = freshHarness();
    const result = await executeAction({ capability: h.capability, request: request({ resourceId: "res_OTHER" }), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(result).toEqual({ ok: false, stage: "capability", reasonCode: "CAPABILITY_SCOPE_MISMATCH" });
    expect(h.adapter.sideEffectCount).toBe(0);
  });

  it("changed approved parameters are rejected -> CAPABILITY_SCOPE_MISMATCH (actionHash folds parameters in)", async () => {
    const h = freshHarness();
    const result = await executeAction({ capability: h.capability, request: request({ actionHash: "h_action_DIFFERENT_PARAMS" }), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(result).toEqual({ ok: false, stage: "capability", reasonCode: "CAPABILITY_SCOPE_MISMATCH" });
  });
});

describe("executeAction — direct adapter bypass (mandatory adversarial test)", () => {
  it("REJECTED, SIDE EFFECT COUNT = 0: a hand-rolled capability that was never minted, passed straight to adapter.execute() with a fabricated ticket, is rejected", async () => {
    const h = freshHarness();
    const forged: Capability = { ...h.capability, id: "cap_never_minted", nonce: "nonce_never_minted" };
    await expect(h.adapter.execute({ operationId: "op_x", idempotencyKey: "idem_x" }, forged, { capabilityId: "cap_never_minted", ticket: "guessed" }, baseParams())).rejects.toThrow(/execution boundary was bypassed/);
    expect(h.adapter.sideEffectCount).toBe(0);
  });

  it("REJECTED, SIDE EFFECT COUNT = 0: even the REAL, registered capability's own ticket cannot be guessed from its public id/nonce", async () => {
    const h = freshHarness();
    await expect(h.adapter.execute({ operationId: "op_x", idempotencyKey: "idem_x" }, h.capability, { capabilityId: h.capability.id, ticket: h.capability.nonce }, baseParams())).rejects.toThrow(/execution boundary was bypassed/);
    expect(h.adapter.sideEffectCount).toBe(0);
  });

  it("REJECTED: calling executeAction with a capability that was minted but never registered in THIS registry instance still fails, closing the gap ActionHarbor's own Week-3 suite explicitly left open ('a direct call to adapter.execute(), skipping executeAction entirely, is not stopped by this module')", async () => {
    const h = freshHarness();
    const unregisteredRegistry = new CapabilityRegistry(); // deliberately NOT the registry h.capability was recorded in
    const result = await executeAction({ capability: h.capability, request: request(), registry: unregisteredRegistry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(result).toEqual({ ok: false, stage: "capability", reasonCode: "CAPABILITY_UNKNOWN" });
    expect(h.adapter.sideEffectCount).toBe(0);
  });
});

describe("executeAction — idempotency (checked on the stateful adapter, not merely a UI-layer flag)", () => {
  it("exact duplicate: same idempotency key, same payload, presented twice via two capabilities minted for the same request -> adapter.execute called exactly once, second call replays the cached receipt", async () => {
    const h = freshHarness();
    const op = { operationId: "op_1", idempotencyKey: "idem_shared" };
    const first = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(first.ok).toBe(true);

    // A second, freshly-minted capability for the identical request+params -> the OperationStore still recognizes the same idempotency key.
    const mint2 = mintCapability({ kind: "policy-allow", decision: ALLOW_DECISION }, request(), h.idGenerator, h.clock, 60_000);
    if (!mint2.ok) throw new Error("unreachable");
    h.registry.record(mint2.capability);
    const second = await executeAction({ capability: mint2.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });

    expect(second.ok).toBe(true);
    if (!second.ok || second.trigger !== "execution_resolved") throw new Error("expected resolved");
    expect(second.replay).toBe(true);
    expect(h.adapter.sideEffectCount).toBe(1); // NOT 2
  });

  it("retry after success: presenting the exact same operation a third time still returns the cached receipt, still without a new adapter call", async () => {
    const h = freshHarness();
    const op = { operationId: "op_1", idempotencyKey: "idem_retry" };
    await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });

    const mint2 = mintCapability({ kind: "policy-allow", decision: ALLOW_DECISION }, request(), h.idGenerator, h.clock, 60_000);
    if (!mint2.ok) throw new Error("unreachable");
    h.registry.record(mint2.capability);
    const retryResult = await executeAction({ capability: mint2.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });

    expect(retryResult).toMatchObject({ ok: true, trigger: "execution_resolved", replay: true });
    expect(h.adapter.sideEffectCount).toBe(1);
  });

  it("same idempotency key, materially DIFFERENT payload -> rejected as a conflict, adapter never called for the conflicting attempt", async () => {
    const h = freshHarness();
    const op = { operationId: "op_1", idempotencyKey: "idem_conflict" };
    await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams({ title: "original title" }), clock: h.clock, idGenerator: h.idGenerator, current: current() });

    const mint2 = mintCapability({ kind: "policy-allow", decision: ALLOW_DECISION }, request(), h.idGenerator, h.clock, 60_000);
    if (!mint2.ok) throw new Error("unreachable");
    h.registry.record(mint2.capability);
    const conflicting = await executeAction({ capability: mint2.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams({ title: "DIFFERENT title" }), clock: h.clock, idGenerator: h.idGenerator, current: current() });

    expect(conflicting).toEqual({ ok: false, stage: "idempotency", reasonCode: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH" });
    expect(h.adapter.sideEffectCount).toBe(1);
  });

  it("concurrent duplicate: two executeAction calls for the same idempotency key racing via Promise.all still produce exactly one side effect", async () => {
    const h = freshHarness();
    const op = { operationId: "op_1", idempotencyKey: "idem_concurrent" };
    const mint2 = mintCapability({ kind: "policy-allow", decision: ALLOW_DECISION }, request(), h.idGenerator, h.clock, 60_000);
    if (!mint2.ok) throw new Error("unreachable");
    h.registry.record(mint2.capability);

    const [a, b] = await Promise.all([
      executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() }),
      executeAction({ capability: mint2.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() }),
    ]);

    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(h.adapter.sideEffectCount).toBe(1);
  });

  it("uncertain/failed prior execution path: a prior attempt recorded as unknown_outcome is never silently retried through the adapter on a duplicate presentation", async () => {
    const h = freshHarness();
    const op = { operationId: "op_1", idempotencyKey: "idem_uncertain" };
    h.operationStore.record({ operationId: op.operationId, idempotencyKey: op.idempotencyKey, capabilityId: h.capability.id, payloadHash: "will-not-be-checked-again", state: "unknown_outcome" });

    const mint2 = mintCapability({ kind: "policy-allow", decision: ALLOW_DECISION }, request(), h.idGenerator, h.clock, 60_000);
    if (!mint2.ok) throw new Error("unreachable");
    h.registry.record(mint2.capability);
    // Payload hash won't match what's on file (nothing was recorded for it originally in a way check() can compare) — but the key point is: the adapter must not be called again for this identity.
    const result = await executeAction({ capability: mint2.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    // Either a conflict (payload hash mismatch against the stub record) or an unknown-outcome replay — either way, never a fresh adapter call.
    expect(h.adapter.sideEffectCount).toBe(0);
    expect(result.ok === false || (result.ok && result.trigger === "execution_unknown_outcome")).toBe(true);
  });
});

describe("executeAction — state drift blocks execution (Gate 6: 'DO NOT EXECUTE')", () => {
  it("resource version changed since mint -> execution refused, adapter never called, routed to reconciliation (w4-007 shape)", async () => {
    const h = freshHarness();
    const result = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current({ resourceVersion: 2 }) });
    expect(result).toMatchObject({ ok: true, trigger: "execution_unknown_outcome", stage: "precondition", reasonCode: "PRECONDITION_FAILED", driftedDimensions: ["RESOURCE_VERSION"] });
    expect(h.adapter.sideEffectCount).toBe(0);
    expect(h.registry.has(h.capability.id)).toBe(true); // capability was never consumed by a blocked attempt
    if (result.ok) expect(transition("EXECUTION_PENDING", result.trigger)).toEqual({ ok: true, nextState: "RECONCILIATION_REQUIRED" });
  });

  it("evidence snapshot changed since mint -> execution refused", async () => {
    const h = freshHarness();
    const result = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current({ evidenceSnapshotId: "snap_STALE" }) });
    expect(result).toMatchObject({ ok: true, stage: "precondition", driftedDimensions: ["EVIDENCE_SNAPSHOT"] });
    expect(h.adapter.sideEffectCount).toBe(0);
  });
});

describe("executeAction — timeout capture (execution result capture)", () => {
  it("an adapter that never resolves within the budget -> execution_unknown_outcome, never silently treated as success or failure", async () => {
    vi.useFakeTimers();
    try {
      const h = freshHarness();
      const hangingAdapter = { actionType: "create_internal_ticket", execute: () => new Promise<TicketReceipt>(() => undefined), lookup: h.adapter.lookup.bind(h.adapter) };
      const resultPromise = executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: hangingAdapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current(), timeoutMs: 5000 });
      await vi.advanceTimersByTimeAsync(5001);
      const result = await resultPromise;
      expect(result).toMatchObject({ ok: true, trigger: "execution_unknown_outcome", stage: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("executeAction — adapter error is captured, never silently swallowed or upgraded to success", () => {
  it("an adapter that throws -> execution_resolved with no receipt, an error message, and no side effect recorded on the adapter", async () => {
    const h = freshHarness();
    const throwingAdapter = { actionType: "create_internal_ticket", execute: () => Promise.reject(new Error("downstream tool unavailable")), lookup: h.adapter.lookup.bind(h.adapter) };
    const result = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: throwingAdapter, operation: { operationId: "op_1", idempotencyKey: "idem_1" }, params: baseParams(), clock: h.clock, idGenerator: h.idGenerator, current: current() });
    expect(result).toMatchObject({ ok: true, trigger: "execution_resolved", adapterErrorMessage: "downstream tool unavailable" });
    if (result.ok && result.trigger === "execution_resolved") expect(result.receipt).toBeUndefined();
  });
});
