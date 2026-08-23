import { describe, expect, it } from "vitest";
import { verifyTicketPostcondition } from "./postcondition.js";

const EXPECTED = { idempotencyKey: "idem_1", title: "customer reports delayed delivery" };

function validReceipt(overrides: Record<string, unknown> = {}) {
  return { ticketId: "tix_1", status: "open", title: "customer reports delayed delivery", idempotencyKey: "idem_1", resourceId: "res_1", createdAt: "2026-08-23T00:00:00.000Z", ...overrides };
}

describe("verifyTicketPostcondition — never trusts narration, only re-derives from the receipt's own fields", () => {
  it("a receipt matching the exact operation verifies", () => {
    expect(verifyTicketPostcondition(validReceipt(), EXPECTED)).toEqual({ ok: true });
  });

  it("null/non-object input never verifies", () => {
    expect(verifyTicketPostcondition(null, EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
    expect(verifyTicketPostcondition(undefined, EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
    expect(verifyTicketPostcondition("adapter says success", EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
    expect(verifyTicketPostcondition(200, EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
  });

  it("an empty object (w3/w4-020-style malformed receipt) never verifies", () => {
    expect(verifyTicketPostcondition({}, EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
  });

  it("status other than 'open' never verifies, however the adapter narrated it", () => {
    expect(verifyTicketPostcondition(validReceipt({ status: "ok" }), EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
    expect(verifyTicketPostcondition(validReceipt({ status: "success" }), EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
  });

  it("a receipt for a DIFFERENT idempotency key does not prove THIS operation succeeded, however well-formed", () => {
    expect(verifyTicketPostcondition(validReceipt({ idempotencyKey: "idem_SOMEONE_ELSE" }), EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
  });

  it("a receipt whose title does not match what was actually asked for does not verify", () => {
    expect(verifyTicketPostcondition(validReceipt({ title: "an entirely different ticket" }), EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
  });

  it("a missing/empty ticketId never verifies, even with every other field correct", () => {
    expect(verifyTicketPostcondition(validReceipt({ ticketId: "" }), EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
    const { ticketId: _ticketId, ...withoutTicketId } = validReceipt();
    expect(verifyTicketPostcondition(withoutTicketId, EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
  });
});
