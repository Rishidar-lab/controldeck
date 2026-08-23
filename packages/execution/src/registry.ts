import type { IdGenerator } from "@controldeck/domain";
import type { Capability, CapabilityRejectionReason } from "./capability.js";

export type RegistryConsumeResult = { readonly ok: true; readonly ticket: ExecutionTicket } | { readonly ok: false; readonly reasonCode: CapabilityRejectionReason };

/**
 * Unforgeable, single-use proof that `CapabilityRegistry.consume` actually
 * ran for this exact capability. `ticket` is minted fresh (via
 * `IdGenerator`, never derived from any field on `Capability` itself — a
 * capability's own `id`/`nonce` are visible to whoever holds the
 * capability object, so they cannot serve as proof of registry
 * consumption; this ticket is a SEPARATE value nobody can compute without
 * having already legitimately called `consume`).
 */
export interface ExecutionTicket {
  readonly capabilityId: string;
  readonly ticket: string;
}

/**
 * The stateful half of capability enforcement (mirrors ActionHarbor's
 * `CapabilityRegistry`, reimplemented independently, with one deliberate
 * strengthening — see `verifyAndInvalidateTicket`'s doc comment).
 * `validateCapability` (`capability.ts`) is pure — given ANY object shaped
 * like a `Capability`, it checks internal consistency, but has no memory,
 * so it cannot tell a genuinely minted capability from a hand-rolled one
 * with identical field values. This registry is that memory.
 */
export class CapabilityRegistry {
  private readonly byId = new Map<string, Capability>();
  private readonly validTickets = new Map<string, string>();

  /** Called only by whatever wraps `mintCapability`'s successful result — never by anything reachable from model/agent output. */
  record(capability: Capability): void {
    this.byId.set(capability.id, capability);
  }

  /**
   * Atomic-in-process (ordinary synchronous JS, no `await` inside — no
   * interleaving within one call): checks membership, nonce, and
   * single-use status, marks the entry consumed, and mints the one
   * `ExecutionTicket` that will ever be valid for this capability — all
   * as part of the same synchronous call. Called before the adapter runs,
   * not after it succeeds: a failed execution still burns the capability
   * rather than leaving it re-attemptable.
   */
  consume(capabilityId: string, nonce: string, idGenerator: IdGenerator): RegistryConsumeResult {
    const stored = this.byId.get(capabilityId);
    if (stored === undefined) {
      return { ok: false, reasonCode: "CAPABILITY_UNKNOWN" };
    }
    if (stored.nonce !== nonce) {
      return { ok: false, reasonCode: "CAPABILITY_NONCE_MISMATCH" };
    }
    if (stored.status !== "active") {
      return { ok: false, reasonCode: "CAPABILITY_ALREADY_CONSUMED" };
    }

    this.byId.set(capabilityId, { ...stored, status: "consumed" });
    const ticket: ExecutionTicket = { capabilityId, ticket: idGenerator.next("ticket") };
    this.validTickets.set(capabilityId, ticket.ticket);
    return { ok: true, ticket };
  }

  /**
   * The direct-adapter-bypass defence: an adapter that requires a valid
   * ticket before doing anything else cannot be invoked by simply
   * hand-crafting a `Capability`-shaped object and calling
   * `adapter.execute()` directly, because no field ON a capability can
   * ever equal a value minted here — the ticket is a value from a
   * SEPARATE map, produced only by `consume`. This closes the residual
   * limitation ActionHarbor's own Week-3 test suite explicitly disclosed
   * ("a direct call to adapter.execute(), skipping executeAction
   * entirely, is not stopped by this module") — here it is stopped.
   *
   * Single-use even for verification itself: a ticket is deleted the
   * moment it is checked, valid or not, so a captured/logged ticket
   * cannot be replayed against the adapter a second time either.
   */
  verifyAndInvalidateTicket(capabilityId: string, ticket: string): boolean {
    const stored = this.validTickets.get(capabilityId);
    this.validTickets.delete(capabilityId);
    return stored !== undefined && stored === ticket;
  }

  /** Test/introspection only — not part of the enforcement path. */
  has(capabilityId: string): boolean {
    return this.byId.has(capabilityId);
  }
}
