import type { AdapterLookupResult } from "@controldeck/execution";

export type ReconciliationResult<TReceipt> =
  | { readonly outcome: "FOUND"; readonly trigger: "reconciliation_found"; readonly receipt: TReceipt }
  | { readonly outcome: "INCONCLUSIVE"; readonly trigger: "reconciliation_inconclusive"; readonly reasonCode: "UNKNOWN_OUTCOME" };

export interface ReadOnlyLookup<TReceipt> {
  lookup(operationId: string): Promise<AdapterLookupResult<TReceipt>>;
}

/**
 * Resolves an `execution_unknown_outcome` via a READ-ONLY lookup — never
 * `adapter.execute`. This function's parameter type is the whole
 * enforcement: `ReadOnlyLookup<TReceipt>` has exactly one method, and it
 * is not `execute`. There is no code path in this module through which a
 * side effect could occur a second time — not a policy this function
 * has to remember to follow, a fact about what it is even capable of
 * calling.
 *
 * `FOUND` -> `reconciliation_found` (VERIFICATION_PENDING; the caller
 * then runs the SAME `classifyResolvedExecution` a fresh success would).
 * `INCONCLUSIVE` -> `reconciliation_inconclusive` (RECONCILIATION_REQUIRED,
 * a self-loop in the real state machine — "postcondition cannot be
 * determined -> UNKNOWN_OUTCOME," Gate 7 test 5). Never retries, never
 * asks a model to guess, never declares success or failure from silence.
 */
export async function reconcile<TReceipt>(adapter: ReadOnlyLookup<TReceipt>, operationId: string): Promise<ReconciliationResult<TReceipt>> {
  const result = await adapter.lookup(operationId);
  if (result.status === "found") {
    return { outcome: "FOUND", trigger: "reconciliation_found", receipt: result.receipt };
  }
  return { outcome: "INCONCLUSIVE", trigger: "reconciliation_inconclusive", reasonCode: "UNKNOWN_OUTCOME" };
}
