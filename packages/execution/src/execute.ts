import type { Clock, IdGenerator } from "@controldeck/domain";
import { hashCanonical } from "@controldeck/domain";
import type { AdapterOperation, AdapterPort } from "./adapter-port.js";
import type { Capability, CapabilityRejectionReason, CapabilityRequest } from "./capability.js";
import { validateCapability } from "./capability.js";
import type { CurrentExecutionState, PreconditionDriftDimension } from "./precondition.js";
import { checkExecutionPreconditions } from "./precondition.js";
import type { OperationRecord, OperationStore } from "./operation-store.js";
import type { CapabilityRegistry } from "./registry.js";

/** `TECHNICAL_SPEC.md`-style operational limit, mirroring ActionHarbor's own per-run execution budget. */
export const DEFAULT_EXECUTION_TIMEOUT_MS = 30_000;

export interface ExecuteActionInput<TParams, TReceipt> {
  readonly capability: Capability;
  readonly request: CapabilityRequest;
  readonly registry: CapabilityRegistry;
  readonly operationStore: OperationStore<TReceipt>;
  readonly adapter: AdapterPort<TParams, TReceipt>;
  readonly operation: AdapterOperation;
  readonly params: TParams;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  /** Live values, re-derived immediately before this call — the state-drift check. */
  readonly current: CurrentExecutionState;
  readonly timeoutMs?: number;
}

export type ExecuteActionFailure =
  | { readonly ok: false; readonly stage: "capability"; readonly reasonCode: CapabilityRejectionReason }
  | { readonly ok: false; readonly stage: "idempotency"; readonly reasonCode: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH" };

/**
 * A pre-execution drift/precondition rejection. `w4-007`'s own expected
 * shape ("Resource version changed before ActionHarbor call" ->
 * `RECONCILIATION_REQUIRED`/`PRECONDITION_FAILED`) is what justifies
 * reusing the `execution_unknown_outcome` trigger here: refusing to call
 * the adapter because assumptions drifted is, from the workflow's point
 * of view, the same "we do not have a resolved outcome" situation a
 * timeout produces — reconciliation's read-only lookup can (and should)
 * confirm nothing happened, the same path it would take for a genuine
 * timeout.
 */
export type ExecuteActionPreconditionFailure = { readonly ok: true; readonly trigger: "execution_unknown_outcome"; readonly stage: "precondition"; readonly reasonCode: "PRECONDITION_FAILED"; readonly driftedDimensions: readonly PreconditionDriftDimension[]; readonly operationId: string };

/**
 * The adapter definitively responded — with a receipt, or by throwing.
 * `ok: true` here means ONLY "execution attempted and resolved," never
 * "the operation succeeded" — "execution attempted is NOT execution
 * proven" (Gate 7's job, via a real postcondition check composed with
 * this result). `replay: true` means this exact outcome was served from
 * `OperationStore` without calling the adapter a second time.
 */
export type ExecuteActionResolved<TReceipt> = { readonly ok: true; readonly trigger: "execution_resolved"; readonly operationId: string; readonly replay: boolean; readonly receipt?: TReceipt; readonly adapterErrorMessage?: string };

export type ExecuteActionUnknownOutcome = { readonly ok: true; readonly trigger: "execution_unknown_outcome"; readonly stage: "timeout"; readonly operationId: string };

export type ExecuteActionResult<TReceipt> = ExecuteActionFailure | ExecuteActionPreconditionFailure | ExecuteActionResolved<TReceipt> | ExecuteActionUnknownOutcome;

type RaceOutcome<T> = { readonly kind: "resolved"; readonly value: T } | { readonly kind: "rejected"; readonly error: unknown } | { readonly kind: "timeout" };

/**
 * Races `promise` against `timeoutMs`. If the timeout wins, `promise` is
 * left running (this function cannot cancel it in plain JS) and a LATE
 * resolution/rejection is deliberately dropped: the caller has already
 * committed to `execution_unknown_outcome`, and a signal arriving after
 * that is exactly what "the side effect may have happened, we do not
 * know yet" means — reconciliation, not this promise, is how it gets
 * resolved.
 */
function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<RaceOutcome<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({ kind: "timeout" });
      }
    }, timeoutMs);

    promise.then(
      (value) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ kind: "resolved", value });
        }
      },
      (error: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ kind: "rejected", error });
        }
      },
    );
  });
}

/**
 * THE single legitimate path to a privileged adapter call — the global
 * invariant made structural: "NO AGENT MAY TURN PROPOSAL INTO SIDE EFFECT
 * DIRECTLY." No model, agent, or specialist output is reachable from
 * anywhere in this function's parameter types (`ExecuteActionInput` reads
 * only already-authorized/already-typed values — a `Capability` minted by
 * `mintCapability`, structured operation/params).
 *
 * Order, each a guard for the next: capability scope/status/expiry ->
 * precondition/state-drift recheck against CURRENT values -> idempotency
 * check -> (new: consume capability, call adapter under a timeout |
 * duplicate+succeeded/failed: replay the recorded outcome, adapter never
 * called again | duplicate+unknown_outcome: still refuse to call the
 * adapter again — Gate 7 resolves this via read-only reconciliation, not
 * this function | conflict: rejected before the adapter is ever called).
 */
export async function executeAction<TParams, TReceipt>(input: ExecuteActionInput<TParams, TReceipt>): Promise<ExecuteActionResult<TReceipt>> {
  const now = input.clock.now();
  const operationId = input.operation.operationId;

  const capabilityCheck = validateCapability(input.capability, input.request, now);
  if (!capabilityCheck.ok) {
    return { ok: false, stage: "capability", reasonCode: capabilityCheck.reasonCode };
  }

  const preconditionCheck = checkExecutionPreconditions(input.capability, input.current);
  if (!preconditionCheck.ok) {
    return { ok: true, trigger: "execution_unknown_outcome", stage: "precondition", reasonCode: preconditionCheck.reasonCode, driftedDimensions: preconditionCheck.driftedDimensions, operationId };
  }

  const payloadHash = hashCanonical(input.params);
  const idempotencyLookup = input.operationStore.check(input.operation.idempotencyKey, payloadHash);

  if (idempotencyLookup.status === "conflict") {
    return { ok: false, stage: "idempotency", reasonCode: "IDEMPOTENCY_KEY_PAYLOAD_MISMATCH" };
  }

  if (idempotencyLookup.status === "duplicate") {
    return replayDuplicate(idempotencyLookup.operation, operationId);
  }

  // "new": a genuinely fresh attempt. Only this path may consume the capability and call the adapter.
  const consumeResult = input.registry.consume(input.capability.id, input.capability.nonce, input.idGenerator);
  if (!consumeResult.ok) {
    return { ok: false, stage: "capability", reasonCode: consumeResult.reasonCode };
  }

  const timeoutMs = input.timeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
  const raceResult = await raceWithTimeout(input.adapter.execute(input.operation, input.capability, consumeResult.ticket, input.params), timeoutMs);

  if (raceResult.kind === "timeout") {
    const record: OperationRecord<TReceipt> = { operationId, idempotencyKey: input.operation.idempotencyKey, capabilityId: input.capability.id, payloadHash, state: "unknown_outcome" };
    input.operationStore.record(record);
    return { ok: true, trigger: "execution_unknown_outcome", stage: "timeout", operationId };
  }

  if (raceResult.kind === "rejected") {
    const errorMessage = raceResult.error instanceof Error ? raceResult.error.message : String(raceResult.error);
    const record: OperationRecord<TReceipt> = { operationId, idempotencyKey: input.operation.idempotencyKey, capabilityId: input.capability.id, payloadHash, state: "failed", errorMessage };
    input.operationStore.record(record);
    return { ok: true, trigger: "execution_resolved", operationId, replay: false, adapterErrorMessage: errorMessage };
  }

  const receipt = raceResult.value;
  const record: OperationRecord<TReceipt> = { operationId, idempotencyKey: input.operation.idempotencyKey, capabilityId: input.capability.id, payloadHash, state: "succeeded", receipt };
  input.operationStore.record(record);
  return { ok: true, trigger: "execution_resolved", operationId, replay: false, receipt };
}

/**
 * A duplicate idempotency-key presentation, already recorded. `succeeded`/
 * `failed` are definite outcomes already — replayed as-is, NO new adapter
 * interaction of any kind (this is the literal implementation of "same
 * idempotency identity -> side effect occurs at most once"). `unknown_outcome`
 * still refuses the adapter — actively resolving it via lookup is Gate 7's
 * reconciliation, not this function's job.
 */
function replayDuplicate<TReceipt>(prior: OperationRecord<TReceipt>, operationId: string): ExecuteActionResult<TReceipt> {
  if (prior.state === "succeeded") {
    return { ok: true, trigger: "execution_resolved", operationId: prior.operationId, replay: true, ...(prior.receipt !== undefined ? { receipt: prior.receipt } : {}) };
  }
  if (prior.state === "failed") {
    return { ok: true, trigger: "execution_resolved", operationId: prior.operationId, replay: true, ...(prior.errorMessage !== undefined ? { adapterErrorMessage: prior.errorMessage } : {}) };
  }
  return { ok: true, trigger: "execution_unknown_outcome", stage: "timeout", operationId };
}
