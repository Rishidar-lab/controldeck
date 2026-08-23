import type { ReasonCode } from "@controldeck/contracts";
import { isClaimSatisfied, type ClaimAssessment } from "@controldeck/evidence";
import type { EvidenceGateDecision } from "./types.js";

/**
 * The evidence-gate decision (`STATE_MACHINE`-equivalent `EVIDENCE_ASSESSED
 * -> {ACTION_PENDING, BLOCKED}`, `ARCHITECTURE.md` row 7/8). Reads ONLY
 * `ClaimAssessment`s — the verified-fact type Gate 2's `assessClaim` alone
 * can construct — never a raw agent's own "this condition is satisfied"
 * text (conflict-handling test 2). Governance test 3 (two verified
 * evidence objects contradict) is handled here: if the SAME claim has more
 * than one assessment on file with DIFFERENT verdicts, that is a
 * deterministic conflict, never resolved by picking one, by majority, or
 * by whichever arrived last.
 */
export function evaluateEvidenceGate(requiredClaimIds: readonly string[], assessments: readonly ClaimAssessment[]): EvidenceGateDecision {
  const byClaimId = new Map<string, ClaimAssessment[]>();
  for (const assessment of assessments) {
    const existing = byClaimId.get(assessment.claimId) ?? [];
    existing.push(assessment);
    byClaimId.set(assessment.claimId, existing);
  }

  const reasonCodes = new Set<ReasonCode>();
  let allSatisfied = true;

  for (const claimId of requiredClaimIds) {
    const claimAssessments = byClaimId.get(claimId);

    if (claimAssessments === undefined || claimAssessments.length === 0) {
      allSatisfied = false;
      reasonCodes.add("EVIDENCE_INSUFFICIENT");
      continue;
    }

    const distinctVerdicts = new Set(claimAssessments.map((a) => a.verdict));
    if (distinctVerdicts.size > 1) {
      // Two verified assessments of the SAME claim disagree — a deterministic conflict outcome, never a majority vote or "latest wins."
      allSatisfied = false;
      reasonCodes.add("CONTRADICTED_EVIDENCE");
      continue;
    }

    const satisfied = claimAssessments.every((a) => isClaimSatisfied(a));
    if (!satisfied) {
      allSatisfied = false;
      for (const a of claimAssessments) {
        if (a.reasonCode !== undefined) reasonCodes.add(a.reasonCode);
      }
    }
  }

  if (allSatisfied) {
    return { outcome: "SATISFIED", reasonCodes: [] };
  }
  return { outcome: "BLOCKED", reasonCodes: [...reasonCodes] };
}
