import type { ReasonCode } from "@controldeck/contracts";

/**
 * Everything a specific approval is bound to (`ARCHITECTURE.md` row 14:
 * "Plan+evidence-snapshot+action hashes exactly match"; `API_SPEC.md`:
 * "Approve exact plan/evidence/action hashes"). `policyVersion` is a
 * disclosed extension beyond the three literal hashes the frozen table
 * names — justified by `EVENT_SCHEMA.md` independently listing
 * `policy_version` as a tracked per-event field alongside `snapshot_id`
 * and `artifact_hashes`, and by this gate's own instruction to reject a
 * "changed governance outcome" (test 9): if the policy that produced the
 * REQUIRE_APPROVAL decision is no longer the current one, the approval no
 * longer means what it meant when granted.
 */
export interface ApprovalBinding {
  readonly workflowId: string;
  readonly planHash: string;
  readonly evidenceSnapshotId: string;
  readonly actionHash: string;
  readonly policyVersion: string;
}

/**
 * "Human approval must not mean 'approve whatever the agents decide
 * later.' It must mean 'approve THIS specific plan/evidence/action
 * snapshot.'" `consumedAt` is set exactly once, by `consumeApproval`
 * (`grant.ts`) — a single-use approval that has been consumed can never
 * match again, even against its own original binding.
 */
export interface Approval {
  readonly approvalId: string;
  readonly binding: ApprovalBinding;
  readonly grantedAt: string;
  readonly expiresAt: string;
  readonly grantedByPrincipal: string;
  readonly consumedAt?: string;
}

/** The binding values as they actually stand at the moment authority is being consumed — supplied by the caller, never read from anywhere inside this package. */
export interface ApprovalConsumptionContext {
  readonly workflowId: string;
  readonly planHash: string;
  readonly evidenceSnapshotId: string;
  readonly actionHash: string;
  readonly policyVersion: string;
  readonly now: Date;
}

export type AuthorityResult = { readonly ok: true } | { readonly ok: false; readonly reasonCodes: readonly ReasonCode[] };
