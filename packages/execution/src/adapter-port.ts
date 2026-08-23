import type { Capability } from "./capability.js";
import type { ExecutionTicket } from "./registry.js";

/** Identifies one execution attempt. Both fields are assigned by the execution boundary, never by the model or the adapter. */
export interface AdapterOperation {
  readonly operationId: string;
  readonly idempotencyKey: string;
}

export type AdapterLookupResult<TReceipt> = { readonly status: "unknown" } | { readonly status: "found"; readonly receipt: TReceipt };

/**
 * The adapter boundary. `execute` REQUIRES an `ExecutionTicket` —
 * unforgeable proof that `CapabilityRegistry.consume` actually ran for
 * this exact capability — in addition to the capability itself. This is
 * what makes "call the adapter directly, skipping the execution boundary
 * entirely" fail, not merely "be against the rules": there is no way to
 * construct a valid ticket without having already gone through
 * `CapabilityRegistry.consume`, which only `executeAction` ever calls.
 *
 * `lookup` is read-only and MUST NOT itself cause a side effect or
 * require a ticket — it exists precisely so an uncertain prior attempt
 * can be resolved without ever calling `execute` a second time (Gate 7
 * reconciliation).
 */
export interface AdapterPort<TParams, TReceipt> {
  readonly actionType: string;
  execute(operation: AdapterOperation, capability: Capability, ticket: ExecutionTicket, params: TParams): Promise<TReceipt>;
  lookup(operationId: string): Promise<AdapterLookupResult<TReceipt>>;
}
