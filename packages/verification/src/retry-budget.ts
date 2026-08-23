export type RetryExhaustionReasonCode = "RETRY_EXHAUSTED" | "RETRY_BUDGET_EXHAUSTED";

export type RetryAttemptResult = { readonly ok: true; readonly attemptsUsed: number; readonly attemptsRemaining: number } | { readonly ok: false; readonly trigger: "retry_budget_exhausted"; readonly reasonCode: RetryExhaustionReasonCode };

/**
 * Bounded, deterministic retry accounting — "No unbounded retry loop. No
 * autonomous model-driven retry storm." There is no method here that
 * retries anything; this class only counts attempts and refuses once the
 * budget is spent. The actual retry LOOP (if any) lives in whatever
 * orchestrator calls this — a later gate — and every one of its
 * iterations must call `recordAttempt` first and stop the instant it
 * returns `ok: false`.
 *
 * `reasonCode` is chosen by the caller at construction, not guessed here
 * — `RETRY_EXHAUSTED` for a research/evidence-fetch retry budget
 * (w4-010's exact code), `RETRY_BUDGET_EXHAUSTED` for the general/
 * execution-adjacent case (w4-021's exact code) — both real corpus
 * reason codes already in `@controldeck/contracts`' `ReasonCode`, chosen
 * per call site rather than invented here.
 */
export class RetryBudget {
  private attempts = 0;

  constructor(
    private readonly maxAttempts: number,
    private readonly reasonCode: RetryExhaustionReasonCode = "RETRY_BUDGET_EXHAUSTED",
  ) {
    if (maxAttempts < 1) {
      throw new RangeError("RetryBudget requires maxAttempts >= 1");
    }
  }

  recordAttempt(): RetryAttemptResult {
    this.attempts += 1;
    if (this.attempts > this.maxAttempts) {
      return { ok: false, trigger: "retry_budget_exhausted", reasonCode: this.reasonCode };
    }
    return { ok: true, attemptsUsed: this.attempts, attemptsRemaining: this.maxAttempts - this.attempts };
  }

  get attemptsUsed(): number {
    return this.attempts;
  }
}
