import type { PostconditionResult, TicketPostconditionExpectation } from "./postcondition.js";
import { verifyTicketPostcondition } from "./postcondition.js";

export type OperationOutcome = "SUCCEEDED" | "FAILED";

export type ClassifyResult = { readonly outcome: "SUCCEEDED"; readonly trigger: "postcondition_pass" } | { readonly outcome: "FAILED"; readonly trigger: "postcondition_fail"; readonly reasonCode: "INVALID_TOOL_OUTPUT" | "POSTCONDITION_FAILED" };

/**
 * The VERIFICATION_PENDING gate: `postcondition_pass` -> COMPLETE,
 * `postcondition_fail` -> FAILED (the real, frozen `transition()` table —
 * composed directly in tests, same discipline as Gates 3/5/6). Reads
 * ONLY `receipt` — an `unknown` value that, at Gate 6, is either a real
 * adapter response or `undefined` (the adapter threw, or this call is
 * being classified before any receipt exists). There is no second
 * parameter through which an agent's own "I verified this" sentence, or
 * a specialist's claimed success, could enter this function at all
 * (Gate 7 test 6: "agent claims 'verified' -> no authoritative effect" —
 * a fact about this signature, not a filter this function has to apply).
 *
 * A missing receipt (test 3: "adapter errors before side effect") is an
 * automatic `FAILED` (`INVALID_TOOL_OUTPUT` — there is nothing to verify
 * a postcondition against) once `verifyTicketPostcondition` is asked to
 * parse `undefined` (fails its `typeof raw !== "object"` guard). No
 * special case needed here beyond that.
 */
export function classifyResolvedExecution(receipt: unknown, expected: TicketPostconditionExpectation): ClassifyResult {
  const check: PostconditionResult = verifyTicketPostcondition(receipt, expected);
  if (!check.ok) {
    return { outcome: "FAILED", trigger: "postcondition_fail", reasonCode: check.reasonCode };
  }
  return { outcome: "SUCCEEDED", trigger: "postcondition_pass" };
}
