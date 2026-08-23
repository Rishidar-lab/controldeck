import type { TicketReceipt } from "@controldeck/execution";

export type PostconditionResult = { readonly ok: true } | { readonly ok: false; readonly reasonCode: "INVALID_TOOL_OUTPUT" | "POSTCONDITION_FAILED" };

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
 * for.
 *
 * Two DISTINCT, deterministic failure reasons, checked in this order —
 * a structural/mechanical distinction, not a semantic one:
 *
 *   1. `INVALID_TOOL_OUTPUT` (w4-020): the value is not even
 *      ticket-receipt-SHAPED at all — null, non-object, wrong `status`,
 *      or a missing/empty `ticketId`. There is nothing here to check a
 *      postcondition against; the tool's response itself is malformed.
 *   2. `POSTCONDITION_FAILED` (w4-030): the value IS a well-formed ticket
 *      receipt, but it is a receipt for a DIFFERENT operation than the
 *      one actually asked for (wrong idempotency key or title) — the
 *      tool's response contradicts what this specific call requested.
 *
 * Takes `unknown`, not `TicketReceipt` — a receipt is exactly as trusted
 * as any other piece of adapter output until it has been shape-checked
 * here; nothing upstream (Gate 6) already validated its shape, only that
 * *a* receipt-shaped value came back.
 */
export function verifyTicketPostcondition(raw: unknown, expected: TicketPostconditionExpectation): PostconditionResult {
  if (raw === null || typeof raw !== "object") return { ok: false, reasonCode: "INVALID_TOOL_OUTPUT" };
  const candidate = raw as Partial<TicketReceipt>;
  if (candidate.status !== "open") return { ok: false, reasonCode: "INVALID_TOOL_OUTPUT" };
  if (typeof candidate.ticketId !== "string" || candidate.ticketId.length === 0) return { ok: false, reasonCode: "INVALID_TOOL_OUTPUT" };

  if (candidate.idempotencyKey !== expected.idempotencyKey) return { ok: false, reasonCode: "POSTCONDITION_FAILED" };
  if (candidate.title !== expected.title) return { ok: false, reasonCode: "POSTCONDITION_FAILED" };
  return VERIFIED;
}
