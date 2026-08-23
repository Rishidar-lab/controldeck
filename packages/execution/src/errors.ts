/** Thrown by an adapter's `execute` when the presented `ExecutionTicket` does not verify — the direct-adapter-bypass defence (see `registry.ts`). */
export class UnauthorizedAdapterInvocationError extends Error {
  constructor(public readonly capabilityId: string) {
    super(`adapter invocation rejected: no valid execution ticket for capability "${capabilityId}" — the execution boundary was bypassed`);
    this.name = "UnauthorizedAdapterInvocationError";
  }
}

/** Defence in depth, mirroring TOOL_CONTRACTS.md-style adapter self-checks: should never fire in practice (the execution boundary's own capability check already excludes this), but the adapter does not assume its caller got that right. */
export class CapabilityActionTypeMismatchError extends Error {
  constructor(
    public readonly expected: string,
    public readonly actual: string,
  ) {
    super(`adapter expects a capability for "${expected}" but received one for "${actual}"`);
    this.name = "CapabilityActionTypeMismatchError";
  }
}

/** Re-submission of the same idempotency key with a materially different payload — the adapter's OWN, independent idempotency memory (defence in depth beyond the execution boundary's own `OperationStore`). */
export class IdempotencyKeyPayloadMismatchError extends Error {
  constructor(public readonly idempotencyKey: string) {
    super(`idempotency key "${idempotencyKey}" was already used with a different payload`);
    this.name = "IdempotencyKeyPayloadMismatchError";
  }
}
