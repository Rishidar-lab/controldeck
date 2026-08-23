import { transition } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { evaluateEvidenceGate } from "./evidence-gate.js";
import { evidenceGateOutcomeToTrigger, governanceOutcomeToTrigger } from "./governance.js";
import { evaluatePolicyGate } from "./policy-gate.js";
import type { EvidenceGateDecision, PolicyGateInput } from "./types.js";

/**
 * "Governance may recommend/authorize a legal transition only through the
 * deterministic state machine." Proven here by actually calling
 * `transition()` with governance's own returned trigger — not merely
 * asserting the trigger's name in isolation (that's what
 * evidence-gate.test.ts / policy-gate.test.ts already do).
 */
describe("governance decisions compose with the real state machine", () => {
  it("ALLOW -> policy_allow is a legal POLICY_PENDING transition, landing on EXECUTION_PENDING", () => {
    const decision = evaluatePolicyGate({
      proposal: { actionId: "a1", actionType: "create_ticket", resourceId: "r1", principalRole: "operator", tenantId: "t1" },
      riskAssessments: [],
      evidenceGate: { outcome: "SATISFIED", reasonCodes: [] },
      forbiddenActionTypes: new Set(),
      requestsNewSubAgentOrTool: false,
    });
    const trigger = governanceOutcomeToTrigger(decision);
    expect(trigger).toBe("policy_allow");
    expect(transition("POLICY_PENDING", trigger)).toEqual({ ok: true, nextState: "EXECUTION_PENDING" });
  });

  it("DENY -> policy_deny is a legal POLICY_PENDING transition, landing on BLOCKED", () => {
    const decision = evaluatePolicyGate({
      proposal: { actionId: "a1", actionType: "execute_shell", resourceId: "r1", principalRole: "operator", tenantId: "t1" },
      riskAssessments: [],
      evidenceGate: { outcome: "SATISFIED", reasonCodes: [] },
      forbiddenActionTypes: new Set(["execute_shell"]),
      requestsNewSubAgentOrTool: false,
    });
    const trigger = governanceOutcomeToTrigger(decision);
    expect(trigger).toBe("policy_deny");
    expect(transition("POLICY_PENDING", trigger)).toEqual({ ok: true, nextState: "BLOCKED" });
  });

  it("REQUIRE_APPROVAL -> policy_requires_approval is a legal POLICY_PENDING transition, landing on APPROVAL_PENDING", () => {
    const input: PolicyGateInput = {
      proposal: { actionId: "a1", actionType: "issue_refund", resourceId: "r1", principalRole: "operator", tenantId: "t1" },
      riskAssessments: [{ actionId: "a1", riskLevel: "HIGH" }],
      evidenceGate: { outcome: "SATISFIED", reasonCodes: [] },
      forbiddenActionTypes: new Set(),
      requestsNewSubAgentOrTool: false,
    };
    const trigger = governanceOutcomeToTrigger(evaluatePolicyGate(input));
    expect(trigger).toBe("policy_requires_approval");
    expect(transition("POLICY_PENDING", trigger)).toEqual({ ok: true, nextState: "APPROVAL_PENDING" });
  });

  it("SATISFIED evidence -> claims_supported is legal from EVIDENCE_ASSESSED, landing on ACTION_PENDING", () => {
    const decision: EvidenceGateDecision = evaluateEvidenceGate(["claim_a"], [{ claimId: "claim_a", verdict: "SUPPORTED", supportingRecordIds: ["rec_1"] }]);
    const trigger = evidenceGateOutcomeToTrigger(decision);
    expect(trigger).toBe("claims_supported");
    expect(transition("EVIDENCE_ASSESSED", trigger)).toEqual({ ok: true, nextState: "ACTION_PENDING" });
  });

  it("BLOCKED evidence -> claim_blocked is legal from EVIDENCE_ASSESSED, landing on BLOCKED", () => {
    const decision = evaluateEvidenceGate(["claim_a"], []);
    const trigger = evidenceGateOutcomeToTrigger(decision);
    expect(trigger).toBe("claim_blocked");
    expect(transition("EVIDENCE_ASSESSED", trigger)).toEqual({ ok: true, nextState: "BLOCKED" });
  });

  it("a governance-produced trigger applied from the WRONG state is rejected by the state machine — governance cannot force a state change the table doesn't allow", () => {
    const decision = evaluatePolicyGate({
      proposal: { actionId: "a1", actionType: "create_ticket", resourceId: "r1", principalRole: "operator", tenantId: "t1" },
      riskAssessments: [],
      evidenceGate: { outcome: "SATISFIED", reasonCodes: [] },
      forbiddenActionTypes: new Set(),
      requestsNewSubAgentOrTool: false,
    });
    const trigger = governanceOutcomeToTrigger(decision); // "policy_allow", only legal from POLICY_PENDING
    expect(transition("INTAKE", trigger)).toEqual({ ok: false, reasonCode: "ILLEGAL_TRANSITION" });
    expect(transition("COMPLETE", trigger)).toEqual({ ok: false, reasonCode: "ILLEGAL_TRANSITION" });
  });
});
