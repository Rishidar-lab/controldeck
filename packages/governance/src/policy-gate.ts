import type { PolicyGateInput, GovernanceDecision } from "./types.js";

/** Immutable within a run (`POLICY_MODEL.md`: "Governance rules are immutable within a run"). */
export const CURRENT_POLICY_VERSION = "controldeck-policy-2026-08-23.1";

function deny(reasonCodes: GovernanceDecision["reasonCodes"]): GovernanceDecision {
  return { outcome: "DENY", reasonCodes, policyVersion: CURRENT_POLICY_VERSION };
}

function requireApproval(reasonCodes: GovernanceDecision["reasonCodes"]): GovernanceDecision {
  return { outcome: "REQUIRE_APPROVAL", reasonCodes, policyVersion: CURRENT_POLICY_VERSION };
}

function allow(): GovernanceDecision {
  return { outcome: "ALLOW", reasonCodes: [], policyVersion: CURRENT_POLICY_VERSION };
}

/**
 * The evaluation logic, allowed to throw. Never call directly — always go
 * through `evaluatePolicyGate`, which is what turns a thrown error into
 * the fail-closed `GOVERNANCE_UNAVAILABLE` decision (`SECURITY_MODEL.md`'s
 * "fail-closed policy" made checkable, the same discipline
 * ActionHarbor's `evaluatePolicy`/`POLICY_UNAVAILABLE` used).
 *
 * Checks run in a fixed order, each a guard for the next: a forbidden tool
 * or composition-drift request is denied outright regardless of evidence
 * or risk (governance test 5: "model says 'override policy'" has no
 * mechanism to reach here at all — see the type of `PolicyGateInput`,
 * which has no field a model's own text could populate); evidence must be
 * satisfied before risk is even considered (an unevidenced high-risk
 * action is `BLOCKED_EVIDENCE`, not `REQUIRE_APPROVAL` — approval is not a
 * substitute for evidence); only once both pass does risk classification
 * decide `REQUIRE_APPROVAL` vs `ALLOW` — and risk is read as a
 * CLASSIFICATION (`riskLevel`), never as a recommended action (governance
 * test 1: "Risk agent says high risk -> governance follows policy [the
 * fixed rule 'HIGH risk always requires approval'], not majority vote or
 * the agent's own suggested action").
 */
function evaluateUnsafe(input: PolicyGateInput): GovernanceDecision {
  if (input.forbiddenActionTypes.has(input.proposal.actionType)) {
    return deny(["FORBIDDEN_TOOL", "COMPOSITION_VIOLATION"]);
  }

  if (input.requestsNewSubAgentOrTool) {
    return deny(["COMPOSITION_DRIFT"]);
  }

  if (input.evidenceGate.outcome === "BLOCKED") {
    return deny(input.evidenceGate.reasonCodes);
  }

  const hasHighRisk = input.riskAssessments.some((assessment) => assessment.riskLevel === "HIGH");
  if (hasHighRisk) {
    return requireApproval(["CUMULATIVE_RISK_REQUIRES_APPROVAL"]);
  }

  return allow();
}

/**
 * The governance policy gate (`POLICY_PENDING -> {APPROVAL_PENDING,
 * EXECUTION_PENDING, BLOCKED}`, `ARCHITECTURE.md` rows 11-13). Pure:
 * same input, same verdict, always — no I/O, no model calls, no reading
 * the system clock. Reads ONLY the structured `PolicyGateInput` — there is
 * no field here a model's free-form output could populate, so "the model
 * cannot directly influence a governance outcome" is a fact about this
 * function's parameter type, not a policy this function has to enforce at
 * runtime.
 */
export function evaluatePolicyGate(input: PolicyGateInput): GovernanceDecision {
  try {
    return evaluateUnsafe(input);
  } catch {
    return deny(["GOVERNANCE_UNAVAILABLE"]);
  }
}
