import { transition } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { RetryBudget } from "./retry-budget.js";

describe("RetryBudget — bounded, deterministic, no unbounded loop", () => {
  it("stays ok within budget and reports the correct remaining count", () => {
    const budget = new RetryBudget(3);
    expect(budget.recordAttempt()).toEqual({ ok: true, attemptsUsed: 1, attemptsRemaining: 2 });
    expect(budget.recordAttempt()).toEqual({ ok: true, attemptsUsed: 2, attemptsRemaining: 1 });
    expect(budget.recordAttempt()).toEqual({ ok: true, attemptsUsed: 3, attemptsRemaining: 0 });
  });

  it("exhausts deterministically on the attempt that exceeds maxAttempts, and stays exhausted on every call after that (no autonomous retry storm)", () => {
    const budget = new RetryBudget(2);
    budget.recordAttempt();
    budget.recordAttempt();
    expect(budget.recordAttempt()).toEqual({ ok: false, trigger: "retry_budget_exhausted", reasonCode: "RETRY_BUDGET_EXHAUSTED" });
    expect(budget.recordAttempt()).toEqual({ ok: false, trigger: "retry_budget_exhausted", reasonCode: "RETRY_BUDGET_EXHAUSTED" });
    expect(budget.attemptsUsed).toBe(4);
  });

  it("the exhaustion result's trigger composes with the real state machine from any of the retryable pending states", () => {
    const budget = new RetryBudget(1);
    budget.recordAttempt();
    const exhausted = budget.recordAttempt();
    expect(exhausted.ok).toBe(false);
    if (exhausted.ok) throw new Error("unreachable");
    expect(transition("EXECUTION_PENDING", exhausted.trigger)).toEqual({ ok: true, nextState: "PAUSED" });
    expect(transition("VERIFICATION_PENDING", exhausted.trigger)).toEqual({ ok: true, nextState: "PAUSED" });
    expect(transition("RECONCILIATION_REQUIRED", exhausted.trigger)).toEqual({ ok: true, nextState: "PAUSED" });
  });

  it("reasonCode is caller-chosen per call site, not guessed: RETRY_EXHAUSTED for a research-style budget (w4-010), RETRY_BUDGET_EXHAUSTED for the general case (w4-021)", () => {
    const researchBudget = new RetryBudget(1, "RETRY_EXHAUSTED");
    researchBudget.recordAttempt();
    expect(researchBudget.recordAttempt()).toMatchObject({ reasonCode: "RETRY_EXHAUSTED" });

    const generalBudget = new RetryBudget(1, "RETRY_BUDGET_EXHAUSTED");
    generalBudget.recordAttempt();
    expect(generalBudget.recordAttempt()).toMatchObject({ reasonCode: "RETRY_BUDGET_EXHAUSTED" });
  });

  it("rejects a non-positive budget at construction — there is no way to build a RetryBudget that never lets a single attempt through, which would be a silent-deadlock footgun, not a real budget", () => {
    expect(() => new RetryBudget(0)).toThrow(RangeError);
    expect(() => new RetryBudget(-1)).toThrow(RangeError);
  });
});
