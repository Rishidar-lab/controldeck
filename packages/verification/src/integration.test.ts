import { CounterIdGenerator, FixedClock, transition } from "@controldeck/domain";
import type { AdapterLookupResult, AdapterOperation, Capability, CapabilityRequest, TicketReceipt } from "@controldeck/execution";
import { CapabilityRegistry, FakeTicketAdapter, OperationStore, executeAction, mintCapability } from "@controldeck/execution";
import type { GovernanceDecision } from "@controldeck/governance";
import { describe, expect, it, vi } from "vitest";
import { classifyResolvedExecution } from "./classify.js";
import { reconcile } from "./reconciliation.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const ALLOW_DECISION: GovernanceDecision = { outcome: "ALLOW", reasonCodes: [], policyVersion: "policy-v1" };

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

const CURRENT = { resourceVersion: 1, evidenceSnapshotId: "snap_1", planHash: "h_plan_1", actionHash: "h_action_1", policyVersion: "policy-v1" };

function harness() {
  const idGenerator = new CounterIdGenerator();
  const clock = new FixedClock(NOW);
  const registry = new CapabilityRegistry();
  const adapter = new FakeTicketAdapter(registry, idGenerator, clock);
  const operationStore = new OperationStore<TicketReceipt>();
  const mint = mintCapability({ kind: "policy-allow", decision: ALLOW_DECISION }, request(), idGenerator, clock, 60_000);
  if (!mint.ok) throw new Error("unreachable");
  registry.record(mint.capability);
  return { idGenerator, clock, registry, adapter, operationStore, capability: mint.capability };
}

/**
 * A genuine end-to-end walk of the whole chain: specialist proposals ->
 * ... -> execution authority -> precondition -> adapter -> verification
 * -> authoritative outcome, using the REAL `executeAction` (Gate 6), the
 * REAL `classifyResolvedExecution`/`reconcile` (Gate 7), and the REAL
 * `transition()` (Gate 1) at every step. This is the "postcondition
 * proof" test matrix from spec, composed rather than asserted in
 * isolation.
 */
describe("full execution + verification chain — postcondition proof matrix", () => {
  it("test 1: adapter says success + postcondition true -> SUCCEEDED, EXECUTION_PENDING -> VERIFICATION_PENDING -> COMPLETE", async () => {
    const h = harness();
    const op: AdapterOperation = { operationId: "op_1", idempotencyKey: "idem_1" };
    const execResult = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: { title: "delayed delivery" }, clock: h.clock, idGenerator: h.idGenerator, current: CURRENT });
    expect(execResult.ok).toBe(true);
    if (!execResult.ok || execResult.trigger !== "execution_resolved") throw new Error("expected resolved");
    const afterExecution = transition("EXECUTION_PENDING", execResult.trigger);
    expect(afterExecution).toEqual({ ok: true, nextState: "VERIFICATION_PENDING" });

    const verdict = classifyResolvedExecution(execResult.receipt, { idempotencyKey: "idem_1", title: "delayed delivery" });
    expect(verdict.outcome).toBe("SUCCEEDED");
    expect(transition("VERIFICATION_PENDING", verdict.trigger)).toEqual({ ok: true, nextState: "COMPLETE" });
  });

  it("test 2: adapter says success + postcondition false -> NOT SUCCEEDED, ends FAILED (the receipt is well-formed but for a different title than actually requested)", async () => {
    const h = harness();
    const op: AdapterOperation = { operationId: "op_1", idempotencyKey: "idem_2" };
    const execResult = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: h.adapter, operation: op, params: { title: "delayed delivery" }, clock: h.clock, idGenerator: h.idGenerator, current: CURRENT });
    if (!execResult.ok || execResult.trigger !== "execution_resolved") throw new Error("expected resolved");

    // The verifier checks against a DIFFERENT expectation than what was actually executed — simulating a postcondition mismatch.
    const verdict = classifyResolvedExecution(execResult.receipt, { idempotencyKey: "idem_2", title: "a completely different ticket" });
    expect(verdict).toMatchObject({ outcome: "FAILED", trigger: "postcondition_fail" });
    expect(transition("VERIFICATION_PENDING", verdict.trigger)).toEqual({ ok: true, nextState: "FAILED" });
  });

  it("test 3: adapter errors before any side effect -> FAILED, no receipt to verify at all", async () => {
    const h = harness();
    const throwingAdapter = { actionType: "create_internal_ticket", execute: () => Promise.reject(new Error("tool unavailable")), lookup: h.adapter.lookup.bind(h.adapter) };
    const execResult = await executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: throwingAdapter, operation: { operationId: "op_1", idempotencyKey: "idem_3" }, params: { title: "x" }, clock: h.clock, idGenerator: h.idGenerator, current: CURRENT });
    if (!execResult.ok || execResult.trigger !== "execution_resolved") throw new Error("expected resolved");
    expect(execResult.receipt).toBeUndefined();

    const verdict = classifyResolvedExecution(execResult.receipt, { idempotencyKey: "idem_3", title: "x" });
    expect(verdict).toEqual({ outcome: "FAILED", trigger: "postcondition_fail", reasonCode: "INVALID_TOOL_OUTPUT" });
  });

  it("test 4: adapter may have executed but the response was lost -> UNKNOWN_OUTCOME first, then RESOLVED via read-only reconciliation, never a second execute() call", async () => {
    const h = harness();
    let sideEffectHappened: TicketReceipt | undefined;
    const lossyAdapter = {
      actionType: "create_internal_ticket" as const,
      execute: vi.fn(async (operation: AdapterOperation, capability: Capability, _ticket: unknown, params: { title: string }) => {
        // The real side effect DOES happen server-side...
        sideEffectHappened = { ticketId: "tix_lost_response", status: "open", title: params.title, idempotencyKey: operation.idempotencyKey, resourceId: capability.resourceId, createdAt: h.clock.now().toISOString() };
        // ...but the caller never finds out synchronously (response lost in transit).
        return new Promise<TicketReceipt>(() => undefined);
      }),
      lookup: async (_operationId: string): Promise<AdapterLookupResult<TicketReceipt>> => (sideEffectHappened ? { status: "found", receipt: sideEffectHappened } : { status: "unknown" }),
    };

    vi.useFakeTimers();
    let execResult;
    try {
      const resultPromise = executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: lossyAdapter, operation: { operationId: "op_1", idempotencyKey: "idem_4" }, params: { title: "delayed delivery" }, clock: h.clock, idGenerator: h.idGenerator, current: CURRENT, timeoutMs: 5000 });
      await vi.advanceTimersByTimeAsync(5001);
      execResult = await resultPromise;
    } finally {
      vi.useRealTimers();
    }

    expect(execResult).toMatchObject({ ok: true, trigger: "execution_unknown_outcome", stage: "timeout" });
    if (!execResult.ok || execResult.trigger !== "execution_unknown_outcome") throw new Error("expected unknown outcome");
    expect(transition("EXECUTION_PENDING", execResult.trigger)).toEqual({ ok: true, nextState: "RECONCILIATION_REQUIRED" });

    // Reconciliation resolves it — the side effect really did happen — WITHOUT calling execute() again.
    const reconciliation = await reconcile(lossyAdapter, "op_1");
    expect(reconciliation).toMatchObject({ outcome: "FOUND", trigger: "reconciliation_found" });
    expect(lossyAdapter.execute).toHaveBeenCalledTimes(1); // the ORIGINAL attempt only — reconciliation never re-invoked it
    expect(transition("RECONCILIATION_REQUIRED", reconciliation.trigger)).toEqual({ ok: true, nextState: "VERIFICATION_PENDING" });

    if (reconciliation.outcome === "FOUND") {
      const verdict = classifyResolvedExecution(reconciliation.receipt, { idempotencyKey: "idem_4", title: "delayed delivery" });
      expect(verdict.outcome).toBe("SUCCEEDED");
      expect(transition("VERIFICATION_PENDING", verdict.trigger)).toEqual({ ok: true, nextState: "COMPLETE" });
    }
  });

  it("test 5: postcondition genuinely cannot be determined -> stays UNKNOWN_OUTCOME, never guessed at, never silently retried", async () => {
    const h = harness();
    const silentAdapter = {
      actionType: "create_internal_ticket" as const,
      execute: vi.fn(() => new Promise<TicketReceipt>(() => undefined)),
      lookup: vi.fn(async (): Promise<AdapterLookupResult<TicketReceipt>> => ({ status: "unknown" })),
    };

    vi.useFakeTimers();
    let execResult;
    try {
      const resultPromise = executeAction({ capability: h.capability, request: request(), registry: h.registry, operationStore: h.operationStore, adapter: silentAdapter, operation: { operationId: "op_1", idempotencyKey: "idem_5" }, params: { title: "x" }, clock: h.clock, idGenerator: h.idGenerator, current: CURRENT, timeoutMs: 5000 });
      await vi.advanceTimersByTimeAsync(5001);
      execResult = await resultPromise;
    } finally {
      vi.useRealTimers();
    }
    expect(execResult).toMatchObject({ ok: true, trigger: "execution_unknown_outcome" });

    const reconciliation = await reconcile(silentAdapter, "op_1");
    expect(reconciliation).toEqual({ outcome: "INCONCLUSIVE", trigger: "reconciliation_inconclusive", reasonCode: "UNKNOWN_OUTCOME" });
    expect(transition("RECONCILIATION_REQUIRED", reconciliation.trigger)).toEqual({ ok: true, nextState: "RECONCILIATION_REQUIRED" });
    expect(silentAdapter.execute).toHaveBeenCalledTimes(1); // never retried
  });
});
