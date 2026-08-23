import type { ReasonCode } from "@controldeck/contracts";
import type { Approval, ApprovalConsumptionContext, AuthorityResult } from "./types.js";

function invalid(reasonCodes: readonly ReasonCode[]): AuthorityResult {
  return { ok: false, reasonCodes };
}

/**
 * Whether one specific `Approval` grants authority for one specific
 * consumption attempt. Every binding dimension is checked independently
 * and explicitly (`ARCHITECTURE.md` row 15: "Plan hash, evidence
 * snapshot, or action hash no longer matches" -> `CONFLICT`) — there is
 * no aggregate "close enough" comparison and no dimension that, left
 * unchecked, could let a stale approval slip through.
 *
 * Reason-code mapping is pinned to the exact per-case corpus expectation
 * where one exists, not to a single generic code for every mismatch:
 *   - plan hash mismatch -> `APPROVAL_INVALIDATED` + `SNAPSHOT_CHANGED` (w4-006, exact)
 *   - evidence snapshot mismatch -> `SNAPSHOT_CHANGED` alone (w4-022/w4-025, exact)
 *   - everything else (expiry, consumption, workflow/action/policy-version
 *     mismatch) has no corpus case of its own; `APPROVAL_EXPIRED` is the
 *     frozen code for the first (`ARCHITECTURE.md` row 17), and
 *     `APPROVAL_INVALIDATED` alone — "this approval no longer applies" —
 *     is the disclosed choice for the rest, since none of them are an
 *     evidence-corpus concern.
 */
export function matchApproval(approval: Approval, context: ApprovalConsumptionContext): AuthorityResult {
  if (approval.consumedAt !== undefined) {
    return invalid(["APPROVAL_INVALIDATED"]);
  }

  const expiresAtMs = new Date(approval.expiresAt).getTime();
  if (Number.isNaN(expiresAtMs) || context.now.getTime() > expiresAtMs) {
    // A corrupted/unparseable expiresAt fails closed as expired, never as "not expired."
    return invalid(["APPROVAL_EXPIRED"]);
  }

  if (approval.binding.workflowId !== context.workflowId) {
    return invalid(["APPROVAL_INVALIDATED"]);
  }

  if (approval.binding.planHash !== context.planHash) {
    return invalid(["APPROVAL_INVALIDATED", "SNAPSHOT_CHANGED"]);
  }

  if (approval.binding.evidenceSnapshotId !== context.evidenceSnapshotId) {
    return invalid(["SNAPSHOT_CHANGED"]);
  }

  if (approval.binding.actionHash !== context.actionHash) {
    return invalid(["APPROVAL_INVALIDATED"]);
  }

  if (approval.binding.policyVersion !== context.policyVersion) {
    return invalid(["APPROVAL_INVALIDATED"]);
  }

  return { ok: true };
}

/**
 * The full "is there authority" check, including the case `matchApproval`
 * cannot express: no `Approval` at all (Gate 5 test 2). `AGENT_CONTRACTS.md`'s
 * "no privileged execution exists yet at Gate 5" — this function's `ok: true`
 * means AUTHORITY STATE only, never itself an execution.
 */
export function evaluateAuthority(approval: Approval | undefined, context: ApprovalConsumptionContext): AuthorityResult {
  if (approval === undefined) {
    return invalid(["APPROVAL_INVALIDATED"]);
  }
  return matchApproval(approval, context);
}
