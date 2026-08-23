export type OperationOutcomeState = "succeeded" | "failed" | "unknown_outcome";

export interface OperationRecord<TReceipt> {
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly capabilityId: string;
  readonly payloadHash: string;
  readonly state: OperationOutcomeState;
  readonly receipt?: TReceipt;
  readonly errorMessage?: string;
}

export type OperationLookup<TReceipt> = { readonly status: "new" } | { readonly status: "duplicate"; readonly operation: OperationRecord<TReceipt> } | { readonly status: "conflict" };

/**
 * The execution boundary's OWN idempotency bookkeeping — distinct from
 * (and in addition to) a real adapter's own internal memory (a real
 * external tool would not remember anything about a prior call the way
 * `FakeTicketAdapter` happens to; the caller has to track it regardless
 * of what the adapter itself remembers).
 *
 * `check()` is consulted BEFORE the adapter is ever called: `"duplicate"`
 * means "do not call the adapter again, here is the prior outcome";
 * `"conflict"` means "do not call the adapter at all — same idempotency
 * key, a materially different payload." Only `"new"` proceeds to
 * `adapter.execute`.
 */
export class OperationStore<TReceipt> {
  private readonly byIdempotencyKey = new Map<string, OperationRecord<TReceipt>>();
  private readonly byOperationId = new Map<string, OperationRecord<TReceipt>>();

  check(idempotencyKey: string, payloadHash: string): OperationLookup<TReceipt> {
    const existing = this.byIdempotencyKey.get(idempotencyKey);
    if (existing === undefined) {
      return { status: "new" };
    }
    if (existing.payloadHash !== payloadHash) {
      return { status: "conflict" };
    }
    return { status: "duplicate", operation: existing };
  }

  record(operation: OperationRecord<TReceipt>): void {
    this.byIdempotencyKey.set(operation.idempotencyKey, operation);
    this.byOperationId.set(operation.operationId, operation);
  }

  lookup(operationId: string): OperationRecord<TReceipt> | undefined {
    return this.byOperationId.get(operationId);
  }
}
