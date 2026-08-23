import type { Clock, IdGenerator } from "@controldeck/domain";
import type { Approval, ApprovalBinding } from "./types.js";

/** `AGENT_CONTRACTS.md`, Human control row: "TTL 10m; no automated retry." */
const APPROVAL_TTL_MS = 10 * 60 * 1000;

export interface GrantApprovalInput {
  readonly binding: ApprovalBinding;
  readonly grantedByPrincipal: string;
}

/**
 * THE only function in this codebase permitted to construct an `Approval`
 * — the human-authority analogue of `assessClaim` (Gate 2, the sole
 * constructor of `ClaimAssessment`) and `evaluatePolicyGate` (Gate 3, the
 * sole constructor of a `GovernanceDecision`). An agent's own text
 * claiming "approved: true" is not this type and grants nothing: Gate 4's
 * `RawPlanArtifact`/`RawEvidenceBundle` schemas have no field that could
 * even express it (any extra field is `SCHEMA_INVALID`), and Gate 3's
 * `PolicyGateInput` has no field for a claimed approval either
 * (conflict-handling test 4). WHO is allowed to call this function — i.e.
 * verifying the caller is actually a human with the right role — is an
 * API/auth-layer concern this gate does not build (`AUTHORITY_MODEL.md`'s
 * "delegation is explicit, scoped, expiring, and recorded" chain starts
 * upstream of this function); what this gate guarantees structurally is
 * that no OTHER function anywhere in the codebase produces this type.
 */
export function grantApproval(input: GrantApprovalInput, clock: Clock, idGenerator: IdGenerator): Approval {
  const now = clock.now();
  const expiresAt = new Date(now.getTime() + APPROVAL_TTL_MS);
  return {
    approvalId: idGenerator.next("approval"),
    binding: input.binding,
    grantedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    grantedByPrincipal: input.grantedByPrincipal,
  };
}

/**
 * Marks an approval consumed. Pure — returns a NEW record; this package
 * holds no state of its own, so persisting "this approval id has been
 * consumed" so a SECOND consumption attempt sees it is the future
 * orchestrator's (Gate 6+) job. What Gate 5 guarantees is only that
 * `matchApproval` correctly rejects an `Approval` value that already
 * carries a `consumedAt`, whoever supplies it.
 */
export function consumeApproval(approval: Approval, clock: Clock): Approval {
  return { ...approval, consumedAt: clock.now().toISOString() };
}
