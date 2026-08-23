import { transition } from "@controldeck/domain";
import { describe, expect, it, vi } from "vitest";
import { reconcile } from "./reconciliation.js";

describe("reconcile — found (postcondition proof test 4: response lost but the side effect already happened)", () => {
  it("a receipt found via read-only lookup -> FOUND, reconciliation_found, a legal RECONCILIATION_REQUIRED -> VERIFICATION_PENDING transition — resolved WITHOUT ever calling execute again", async () => {
    const lookup = vi.fn().mockResolvedValue({ status: "found", receipt: { ticketId: "tix_1" } });
    const result = await reconcile({ lookup }, "op_1");
    expect(result).toEqual({ outcome: "FOUND", trigger: "reconciliation_found", receipt: { ticketId: "tix_1" } });
    expect(transition("RECONCILIATION_REQUIRED", result.trigger)).toEqual({ ok: true, nextState: "VERIFICATION_PENDING" });
    expect(lookup).toHaveBeenCalledExactlyOnceWith("op_1");
  });
});

describe("reconcile — inconclusive (postcondition proof test 5: postcondition cannot be determined -> UNKNOWN_OUTCOME)", () => {
  it("lookup finds nothing -> INCONCLUSIVE, reconciliation_inconclusive, a legal RECONCILIATION_REQUIRED -> RECONCILIATION_REQUIRED self-loop, NOT retried, NOT declared success or failure", async () => {
    const lookup = vi.fn().mockResolvedValue({ status: "unknown" });
    const result = await reconcile({ lookup }, "op_1");
    expect(result).toEqual({ outcome: "INCONCLUSIVE", trigger: "reconciliation_inconclusive", reasonCode: "UNKNOWN_OUTCOME" });
    expect(transition("RECONCILIATION_REQUIRED", result.trigger)).toEqual({ ok: true, nextState: "RECONCILIATION_REQUIRED" });
  });
});

describe("reconcile — UNKNOWN_OUTCOME must not be silently retried", () => {
  it("reconcile's own parameter type has no 'execute' method at all — there is no code path in this module through which a side effect could be attempted a second time", async () => {
    // ReadOnlyLookup<TReceipt> is `{ lookup(...): Promise<...> }` — structurally,
    // an object with only `lookup` satisfies it; an adapter that ALSO exposes
    // `execute` is accepted, but reconcile() never references `.execute` anywhere
    // in its own body (reconciliation.ts — read the whole function: one call,
    // to `adapter.lookup`, nothing else). This test proves the concrete case:
    // even when the object handed to `reconcile` HAS an `execute` method, calling
    // reconcile never touches it.
    const execute = vi.fn();
    const lookup = vi.fn().mockResolvedValue({ status: "unknown" });
    const adapterWithExecute = { lookup, execute };
    await reconcile(adapterWithExecute, "op_1");
    expect(execute).not.toHaveBeenCalled();
  });
});
