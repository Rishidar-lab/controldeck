import type { GovernanceDecision } from "@controldeck/governance";
import type { Approval } from "@controldeck/authority";
import type { Clock, IdGenerator } from "@controldeck/domain";

/**
 * `AUTHORITY_MODEL.md`: "A capability is bound to principal, tenant, action
 * type, resource, workflow id, plan hash, policy version, expiry, and
 * nonce. It cannot be transferred between agents or used for another
 * resource." `evidenceSnapshotId`/`actionHash`/`expectedResourceVersion`
 * are disclosed extensions beyond that literal list — justified directly
 * by THIS gate's own "state drift" example list (resource version,
 * evidence snapshot, action parameters), and `actionHash` reuses Gate 5's
 * own combined action+parameters hash (`@controldeck/authority`'s
 * `hashAction`) rather than inventing a second, differently-shaped hash.
 */
export interface Capability {
  readonly id: string;
  readonly nonce: string;
  readonly principalRole: string;
  readonly tenantId: string;
  readonly actionType: string;
  readonly resourceId: string;
  readonly workflowId: string;
  readonly planHash: string;
  readonly evidenceSnapshotId: string;
  readonly actionHash: string;
  readonly policyVersion: string;
  readonly expectedResourceVersion: number;
  readonly expiresAt: string;
  readonly status: "active" | "consumed";
}

/** What a caller presents at mint time (the thing to be authorized) and, unchanged, at execution time (the thing to be scope-checked). */
export type CapabilityRequest = Omit<Capability, "id" | "nonce" | "expiresAt" | "status">;

/**
 * Local, parse/registry-boundary vocabulary (mirrors Gate 4's
 * `SpecialistOutputRejectionReason` discipline) — distinct from the
 * governed `ReasonCode` enum on purpose: these describe why a capability
 * itself is not currently usable, not a workflow/governance decision.
 */
export type CapabilityRejectionReason = "CAPABILITY_MALFORMED" | "CAPABILITY_UNKNOWN" | "CAPABILITY_NONCE_MISMATCH" | "CAPABILITY_ALREADY_CONSUMED" | "CAPABILITY_EXPIRED" | "CAPABILITY_SCOPE_MISMATCH";

export type CapabilityCheckResult = { readonly ok: true } | { readonly ok: false; readonly reasonCode: CapabilityRejectionReason };

/**
 * Pure scope/status/expiry check: is THIS capability, as it stands, valid
 * for THIS exact request. Checked in order so the reason code is always
 * the first thing wrong: status, then expiry (fail-closed on an
 * unparseable `expiresAt` — `NaN <= x` is always false in JS, so without
 * the explicit `Number.isNaN` guard a corrupted expiry would silently
 * skip the expiry rejection), then exact scope match on every bound
 * dimension.
 */
export function validateCapability(capability: Capability, request: CapabilityRequest, now: Date): CapabilityCheckResult {
  if (capability.status !== "active") {
    return { ok: false, reasonCode: "CAPABILITY_ALREADY_CONSUMED" };
  }

  const expiresAtMs = new Date(capability.expiresAt).getTime();
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return { ok: false, reasonCode: "CAPABILITY_EXPIRED" };
  }

  const scopeMatches =
    capability.principalRole === request.principalRole &&
    capability.tenantId === request.tenantId &&
    capability.actionType === request.actionType &&
    capability.resourceId === request.resourceId &&
    capability.workflowId === request.workflowId &&
    capability.planHash === request.planHash &&
    capability.evidenceSnapshotId === request.evidenceSnapshotId &&
    capability.actionHash === request.actionHash &&
    capability.policyVersion === request.policyVersion &&
    capability.expectedResourceVersion === request.expectedResourceVersion;

  if (!scopeMatches) {
    return { ok: false, reasonCode: "CAPABILITY_SCOPE_MISMATCH" };
  }

  return { ok: true };
}

/**
 * The ONLY two forms of evidence `mintCapability` accepts — no "trust me"
 * escape hatch. This type IS the enforcement of "AI intent is not
 * authority to act" carried into Gate 6: nothing shaped like a raw
 * proposal, a bare `REQUIRE_APPROVAL` verdict, or an unconsumed `Approval`
 * can be passed here without failing one of the checks in `mintCapability`.
 */
export type AuthorizationEvidence = { readonly kind: "policy-allow"; readonly decision: GovernanceDecision } | { readonly kind: "approved"; readonly approval: Approval };

export type CapabilityMintRejectionReason = "POLICY_DID_NOT_ALLOW" | "POLICY_VERSION_MISMATCH" | "APPROVAL_NOT_CONSUMED" | "APPROVAL_SCOPE_MISMATCH";

export type MintCapabilityResult = { readonly ok: true; readonly capability: Capability } | { readonly ok: false; readonly reasonCode: CapabilityMintRejectionReason };

/** `TECHNICAL_SPEC.md`-style operational cap, mirroring ActionHarbor's own 5-minute capability TTL discipline for this prototype. */
export const MAX_CAPABILITY_TTL_MS = 5 * 60 * 1000;

/**
 * THE authority-issuing step, and the ONLY function in this codebase that
 * constructs a `Capability` with `status: "active"`. Re-validates its
 * evidence even though the caller (governance/authority layers) already
 * should have — defence in depth, the same discipline `mintCapability`
 * used in ActionHarbor.
 *
 * `AUTHORITY_MODEL.md`: "Authority is a chain: human principal -> workflow
 * intent -> policy decision -> approval (when needed) -> ActionHarbor
 * capability -> adapter execution. No agent can shorten the chain." This
 * function's own signature IS that chain, made structural: there is no
 * third `evidence.kind`, so nothing shaped like agent output — a
 * `PlannerOutcome`, a `RiskAssessment`, a bare `EvidenceBundleCandidate`
 * — can reach this function at all, let alone satisfy it.
 */
export function mintCapability(evidence: AuthorizationEvidence, request: CapabilityRequest, idGenerator: IdGenerator, clock: Clock, ttlMs: number): MintCapabilityResult {
  if (evidence.kind === "policy-allow") {
    if (evidence.decision.outcome !== "ALLOW") {
      return { ok: false, reasonCode: "POLICY_DID_NOT_ALLOW" };
    }
    if (evidence.decision.policyVersion !== request.policyVersion) {
      return { ok: false, reasonCode: "POLICY_VERSION_MISMATCH" };
    }
  } else {
    if (evidence.approval.consumedAt === undefined) {
      // Only `consumeApproval` (Gate 5) produces this field, and only for
      // an approval that itself passed `matchApproval` — a merely-active
      // (not yet consumed) approval is not evidence a capability was
      // actually granted for this specific attempt.
      return { ok: false, reasonCode: "APPROVAL_NOT_CONSUMED" };
    }
    const b = evidence.approval.binding;
    if (b.workflowId !== request.workflowId || b.planHash !== request.planHash || b.evidenceSnapshotId !== request.evidenceSnapshotId || b.actionHash !== request.actionHash || b.policyVersion !== request.policyVersion) {
      return { ok: false, reasonCode: "APPROVAL_SCOPE_MISMATCH" };
    }
  }

  const cappedTtlMs = Math.min(ttlMs, MAX_CAPABILITY_TTL_MS);
  const now = clock.now();

  const capability: Capability = {
    id: idGenerator.next("cap"),
    nonce: idGenerator.next("nonce"),
    principalRole: request.principalRole,
    tenantId: request.tenantId,
    actionType: request.actionType,
    resourceId: request.resourceId,
    workflowId: request.workflowId,
    planHash: request.planHash,
    evidenceSnapshotId: request.evidenceSnapshotId,
    actionHash: request.actionHash,
    policyVersion: request.policyVersion,
    expectedResourceVersion: request.expectedResourceVersion,
    expiresAt: new Date(now.getTime() + cappedTtlMs).toISOString(),
    status: "active",
  };

  return { ok: true, capability };
}
