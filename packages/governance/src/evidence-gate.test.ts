import type { ClaimAssessment } from "@controldeck/evidence";
import { describe, expect, it } from "vitest";
import { evaluateEvidenceGate } from "./evidence-gate.js";

function supported(claimId: string, recordIds: readonly string[] = ["rec_1"]): ClaimAssessment {
  return { claimId, verdict: "SUPPORTED", supportingRecordIds: recordIds };
}

function unsupported(claimId: string, reasonCode: NonNullable<ClaimAssessment["reasonCode"]>): ClaimAssessment {
  return { claimId, verdict: "UNSUPPORTED", supportingRecordIds: [], reasonCode };
}

describe("evaluateEvidenceGate — SATISFIED", () => {
  it("every required claim has a SUPPORTED assessment", () => {
    const result = evaluateEvidenceGate(["claim_a", "claim_b"], [supported("claim_a"), supported("claim_b")]);
    expect(result).toEqual({ outcome: "SATISFIED", reasonCodes: [] });
  });

  it("extra, non-required assessments do not affect the outcome", () => {
    const result = evaluateEvidenceGate(["claim_a"], [supported("claim_a"), unsupported("claim_unrelated", "EVIDENCE_INSUFFICIENT")]);
    expect(result.outcome).toBe("SATISFIED");
  });
});

describe("evaluateEvidenceGate — BLOCKED, missing/unverified/stale evidence", () => {
  it("a required claim with no assessment on file at all -> EVIDENCE_INSUFFICIENT (missing evidence)", () => {
    const result = evaluateEvidenceGate(["claim_a"], []);
    expect(result).toEqual({ outcome: "BLOCKED", reasonCodes: ["EVIDENCE_INSUFFICIENT"] });
  });

  it("a claim whose only assessment is UNSUPPORTED (unverified/stale/forged/tampered — whatever Gate 2 determined) blocks, passing through the real reason code", () => {
    expect(evaluateEvidenceGate(["claim_a"], [unsupported("claim_a", "SNAPSHOT_CHANGED")])).toEqual({ outcome: "BLOCKED", reasonCodes: ["SNAPSHOT_CHANGED"] });
    expect(evaluateEvidenceGate(["claim_a"], [unsupported("claim_a", "CROSS_TENANT_EVIDENCE")])).toEqual({ outcome: "BLOCKED", reasonCodes: ["CROSS_TENANT_EVIDENCE"] });
    expect(evaluateEvidenceGate(["claim_a"], [unsupported("claim_a", "EVIDENCE_INTEGRITY_FAILED")])).toEqual({
      outcome: "BLOCKED",
      reasonCodes: ["EVIDENCE_INTEGRITY_FAILED"],
    });
  });

  it("an agent's own text claiming the condition is satisfied has no field to even express that here — only ClaimAssessment (the Gate 2 verified-fact type) is ever read (conflict-handling test 2)", () => {
    // There is no way to construct a "the agent says it's fine" input at all:
    // evaluateEvidenceGate's second parameter is typed `readonly ClaimAssessment[]`,
    // and ClaimAssessment is only ever constructed by assessClaim (Gate 2).
    // A stale/UNSUPPORTED assessment blocks regardless of anything an agent said.
    const result = evaluateEvidenceGate(["claim_a"], [unsupported("claim_a", "SNAPSHOT_CHANGED")]);
    expect(result.outcome).toBe("BLOCKED");
  });

  it("irrelevant evidence — an assessment for a DIFFERENT claim than the one required — does not satisfy the requirement", () => {
    const result = evaluateEvidenceGate(["claim_a"], [supported("claim_unrelated")]);
    expect(result).toEqual({ outcome: "BLOCKED", reasonCodes: ["EVIDENCE_INSUFFICIENT"] });
  });
});

describe("evaluateEvidenceGate — contradictory evidence (conflict-handling test 3)", () => {
  it("two verified assessments of the SAME claim that disagree -> deterministic CONTRADICTED_EVIDENCE, never a majority vote or 'latest wins'", () => {
    const result = evaluateEvidenceGate(["claim_a"], [supported("claim_a"), unsupported("claim_a", "CLAIM_UNSUPPORTED")]);
    expect(result).toEqual({ outcome: "BLOCKED", reasonCodes: ["CONTRADICTED_EVIDENCE"] });
  });

  it("order of the contradicting assessments does not change the outcome", () => {
    const forward = evaluateEvidenceGate(["claim_a"], [supported("claim_a"), unsupported("claim_a", "CLAIM_UNSUPPORTED")]);
    const backward = evaluateEvidenceGate(["claim_a"], [unsupported("claim_a", "CLAIM_UNSUPPORTED"), supported("claim_a")]);
    expect(forward).toEqual(backward);
  });

  it("two SUPPORTED assessments of the same claim (agreeing) are NOT a contradiction", () => {
    const result = evaluateEvidenceGate(["claim_a"], [supported("claim_a", ["rec_1"]), supported("claim_a", ["rec_2"])]);
    expect(result.outcome).toBe("SATISFIED");
  });
});
