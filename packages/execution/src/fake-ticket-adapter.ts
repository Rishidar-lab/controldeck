import type { Clock, IdGenerator } from "@controldeck/domain";
import { hashCanonical } from "@controldeck/domain";
import type { AdapterLookupResult, AdapterOperation, AdapterPort } from "./adapter-port.js";
import type { Capability } from "./capability.js";
import { CapabilityActionTypeMismatchError, IdempotencyKeyPayloadMismatchError, UnauthorizedAdapterInvocationError } from "./errors.js";
import type { CapabilityRegistry, ExecutionTicket } from "./registry.js";

export interface CreateTicketParams {
  readonly title: string;
  readonly description?: string;
}

export interface TicketReceipt {
  readonly ticketId: string;
  readonly status: "open";
  readonly title: string;
  readonly idempotencyKey: string;
  readonly resourceId: string;
  readonly createdAt: string;
}

interface IdempotencyRecord {
  readonly payloadHash: string;
  readonly receipt: TicketReceipt;
}

/**
 * A real, stateful fake — not a hard-coded response. Requires a valid
 * `ExecutionTicket` (verified against the SAME `CapabilityRegistry`
 * instance the execution boundary consumed the capability from) before
 * doing anything else, and before any state mutation — a call presenting
 * a hand-crafted capability with no genuine ticket throws immediately,
 * mutating nothing, so `sideEffectCount` stays 0 (the mandatory direct-
 * adapter-bypass adversarial test).
 *
 * `execute` deliberately has NO `await` before its synchronous
 * idempotency-check-and-write — that is what makes "concurrent duplicate"
 * safe within Node's single-threaded event loop: two calls presenting the
 * same idempotency key cannot interleave mid-check, because there is no
 * yield point between reading `byIdempotencyKey` and writing to it.
 */
export class FakeTicketAdapter implements AdapterPort<CreateTicketParams, TicketReceipt> {
  readonly actionType = "create_internal_ticket";

  private readonly byOperationId = new Map<string, TicketReceipt>();
  private readonly byIdempotencyKey = new Map<string, IdempotencyRecord>();

  /** Incremented ONLY when a genuinely NEW ticket is minted — never on an idempotent replay. The precise "SIDE EFFECT COUNT" the adversarial and idempotency tests assert on. */
  sideEffectCount = 0;

  constructor(
    private readonly registry: CapabilityRegistry,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(operation: AdapterOperation, capability: Capability, ticket: ExecutionTicket, params: CreateTicketParams): Promise<TicketReceipt> {
    if (!this.registry.verifyAndInvalidateTicket(capability.id, ticket.ticket)) {
      throw new UnauthorizedAdapterInvocationError(capability.id);
    }
    if (capability.actionType !== this.actionType) {
      throw new CapabilityActionTypeMismatchError(this.actionType, capability.actionType);
    }

    const payloadHash = hashCanonical(params);
    const existing = this.byIdempotencyKey.get(operation.idempotencyKey);

    let receipt: TicketReceipt;
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new IdempotencyKeyPayloadMismatchError(operation.idempotencyKey);
      }
      receipt = existing.receipt;
    } else {
      receipt = {
        ticketId: this.idGenerator.next("tix"),
        status: "open",
        title: params.title,
        idempotencyKey: operation.idempotencyKey,
        resourceId: capability.resourceId,
        createdAt: this.clock.now().toISOString(),
      };
      this.byIdempotencyKey.set(operation.idempotencyKey, { payloadHash, receipt });
      this.sideEffectCount += 1;
    }

    // Registered under THIS call's operationId even on an idempotent
    // replay, so a lookup(operationId) for this specific call always
    // resolves — regardless of which operationId first created the ticket.
    this.byOperationId.set(operation.operationId, receipt);
    return receipt;
  }

  async lookup(operationId: string): Promise<AdapterLookupResult<TicketReceipt>> {
    const receipt = this.byOperationId.get(operationId);
    return receipt ? { status: "found", receipt } : { status: "unknown" };
  }
}
