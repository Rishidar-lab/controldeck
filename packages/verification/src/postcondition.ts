import type { TicketReceipt } from "@controldeck/execution";

export type PostconditionResult = { readonly ok: true } | { readonly ok: false; readonly reasonCode: "POSTCONDITION_FAILED" };

const UNVERIFIED: PostconditionResult = { ok: false, reasonCode: "POSTCONDITION_FAILED" };
const VERIFIED: PostconditionResult = { ok: true };

export interface TicketPostconditionExpectation {
  readonly idempotencyKey: string;
  readonly title: string;
}

/**
 * "Execution attempted is NOT execution proven." Never trusts a receipt's
 * mere presence, an adapter's `status: "open"` narration, or the fact
 * that a promise resolved — re-derives the postcondition from the
 * receipt's OWN fields against what THIS specific call actually asked
 * for. A receipt for a different idempotency key or a different title is
 * not proof of THIS operation's success, no matter how well-formed it is.
 *
 * Takes `unknown`, not `TicketReceipt` — a receipt is exactly as trusted
 * as any other piece of adapter output until it has been shape-checked
 * here; nothing upstream (Gate 6) already validated its shape, only that
 * *a* receipt-shaped value came back.
 */
export function verifyTicketPostcondition(raw: unknown, expected: TicketPostconditionExpectation): PostconditionResult {
  if (raw === null || typeof raw !== "object") return UNVERIFIED;
  const candidate = raw as Partial<TicketReceipt>;
  if (candidate.status !== "open") return UNVERIFIED;
  if (typeof candidate.ticketId !== "string" || candidate.ticketId.length === 0) return UNVERIFIED;
  if (candidate.idempotencyKey !== expected.idempotencyKey) return UNVERIFIED;
  if (candidate.title !== expected.title) return UNVERIFIED;
  return VERIFIED;
}
