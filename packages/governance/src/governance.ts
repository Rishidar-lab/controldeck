import type { WorkflowStateTrigger } from "@controldeck/contracts";
import type { EvidenceGateDecision, GovernanceDecision } from "./types.js";

/**
 * Maps a governance decision to the ONE trigger `packages/domain`'s
 * `transition()` will accept from `POLICY_PENDING` — governance never
 * mutates workflow state itself, it only ever recommends a trigger that
 * the state machine (the sole authority on legal transitions) accepts or
 * rejects. "Governance may recommend/authorize a legal transition only
 * through the deterministic state machine" — proven directly in
 * `governance.test.ts` by actually calling `transition()` with the
 * returned trigger, not just asserting the trigger name in isolation.
 */
export function governanceOutcomeToTrigger(decision: GovernanceDecision): WorkflowStateTrigger {
  switch (decision.outcome) {
    case "ALLOW":
      return "policy_allow";
    case "REQUIRE_APPROVAL":
      return "policy_requires_approval";
    case "DENY":
      return "policy_deny";
  }
}

/** Same mapping discipline for the evidence gate's `EVIDENCE_ASSESSED -> {ACTION_PENDING, BLOCKED}` decision. */
export function evidenceGateOutcomeToTrigger(decision: EvidenceGateDecision): WorkflowStateTrigger {
  return decision.outcome === "SATISFIED" ? "claims_supported" : "claim_blocked";
}
