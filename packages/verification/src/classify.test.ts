import { transition } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { classifyResolvedExecution } from "./classify.js";

const EXPECTED = { idempotencyKey: "idem_1", title: "customer reports delayed delivery" };

function validReceipt(overrides: Record<string, unknown> = {}) {
  return { ticketId: "tix_1", status: "open", title: "customer reports delayed delivery", idempotencyKey: "idem_1", resourceId: "res_1", createdAt: "2026-08-23T00:00:00.000Z", ...overrides };
}

describe("classifyResolvedExecution — postcondition proof test 1: adapter says success + postcondition true -> SUCCEEDED", () => {
  it("a receipt that genuinely satisfies the postcondition -> SUCCEEDED, postcondition_pass, a legal VERIFICATION_PENDING -> COMPLETE transition", () => {
    const result = classifyResolvedExecution(validReceipt(), EXPECTED);
    expect(result).toEqual({ outcome: "SUCCEEDED", trigger: "postcondition_pass" });
    expect(transition("VERIFICATION_PENDING", result.trigger)).toEqual({ ok: true, nextState: "COMPLETE" });
  });
});

describe("classifyResolvedExecution — postcondition proof test 2: adapter says success + postcondition false -> NOT SUCCEEDED", () => {
  it("a well-formed but wrong receipt (adapter's own transport-success signal is not enough) -> FAILED, postcondition_fail, a legal VERIFICATION_PENDING -> FAILED transition", () => {
    const result = classifyResolvedExecution(validReceipt({ title: "wrong ticket entirely" }), EXPECTED);
    expect(result).toEqual({ outcome: "FAILED", trigger: "postcondition_fail", reasonCode: "POSTCONDITION_FAILED" });
    expect(transition("VERIFICATION_PENDING", result.trigger)).toEqual({ ok: true, nextState: "FAILED" });
  });
});

describe("classifyResolvedExecution — postcondition proof test 3: adapter errors before side effect -> FAILED", () => {
  it("no receipt at all (the adapter threw) -> automatic FAILED, nothing to verify a postcondition against", () => {
    const result = classifyResolvedExecution(undefined, EXPECTED);
    expect(result).toEqual({ outcome: "FAILED", trigger: "postcondition_fail", reasonCode: "INVALID_TOOL_OUTPUT" });
  });
});

describe("classifyResolvedExecution — postcondition proof test 6: agent claims 'verified' -> no authoritative effect", () => {
  it("a receipt with an extra agent-claimed 'verifiedByAgent'/'confidence' field is classified IDENTICALLY to one without it — only the real receipt fields this function actually reads matter", () => {
    const plain = classifyResolvedExecution(validReceipt(), EXPECTED);
    const withAgentClaim = classifyResolvedExecution({ ...validReceipt(), verifiedByAgent: true, confidence: 0.99, agentNote: "I have verified this personally" }, EXPECTED);
    expect(withAgentClaim).toEqual(plain);
  });

  it("an agent's bare claim, with NO real receipt fields at all, verifies nothing no matter how confident it sounds", () => {
    const result = classifyResolvedExecution({ verifiedByAgent: true, confidence: 1.0, note: "trust me, it worked" }, EXPECTED);
    expect(result).toEqual({ outcome: "FAILED", trigger: "postcondition_fail", reasonCode: "INVALID_TOOL_OUTPUT" });
  });
});
