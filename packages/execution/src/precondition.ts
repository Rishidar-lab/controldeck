import type { Capability } from "./capability.js";

/** Live values re-derived FRESH, immediately before execution — never the values the capability was minted with. */
export interface CurrentExecutionState {
  readonly resourceVersion: number;
  readonly evidenceSnapshotId: string;
  readonly planHash: string;
  readonly actionHash: string;
  readonly policyVersion: string;
}

export type PreconditionDriftDimension = "RESOURCE_VERSION" | "EVIDENCE_SNAPSHOT" | "PLAN" | "ACTION" | "POLICY_VERSION";

export type PreconditionCheckResult = { readonly ok: true } | { readonly ok: false; readonly reasonCode: "PRECONDITION_FAILED"; readonly driftedDimensions: readonly PreconditionDriftDimension[] };

/**
 * The pre-execution freshness recheck — "Immediately before execution
 * revalidate relevant assumptions. If any material state changed since
 * approval: DO NOT EXECUTE." Distinct from `validateCapability`
 * (capability.ts, "is this capability even the right shape/scope for
 * this request") — this compares the capability's bound values against
 * what is ACTUALLY true right now, catching drift that happened AFTER
 * the capability was minted (TOCTOU): a resource edited, an evidence
 * corpus re-indexed, a plan or action changed, a policy redeployed.
 *
 * Reports every drifted dimension at once (not just the first) — for
 * this specific check, unlike `validateCapability`'s "first thing
 * wrong," the caller (audit/reporting) benefits from seeing the full
 * extent of what moved, not just one symptom of it. `PRECONDITION_FAILED`
 * itself is the exact governed `ReasonCode` (w4-007); `driftedDimensions`
 * is local detail, mirroring ActionHarbor's own `[PRECONDITION_FAILED,
 * RESOURCE_VERSION_CHANGED]` pairing of one governed code with a local
 * detail code.
 */
export function checkExecutionPreconditions(capability: Capability, current: CurrentExecutionState): PreconditionCheckResult {
  const drifted: PreconditionDriftDimension[] = [];

  if (capability.planHash !== current.planHash) drifted.push("PLAN");
  if (capability.evidenceSnapshotId !== current.evidenceSnapshotId) drifted.push("EVIDENCE_SNAPSHOT");
  if (capability.actionHash !== current.actionHash) drifted.push("ACTION");
  if (capability.policyVersion !== current.policyVersion) drifted.push("POLICY_VERSION");
  if (capability.expectedResourceVersion !== current.resourceVersion) drifted.push("RESOURCE_VERSION");

  if (drifted.length > 0) {
    return { ok: false, reasonCode: "PRECONDITION_FAILED", driftedDimensions: drifted };
  }
  return { ok: true };
}
