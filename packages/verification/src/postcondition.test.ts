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

  describe("INVALID_TOOL_OUTPUT (w4-020): the value is not even receipt-shaped", () => {
    it("null/non-object input", () => {
      expect(verifyTicketPostcondition(null, EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
      expect(verifyTicketPostcondition(undefined, EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
      expect(verifyTicketPostcondition("adapter says success", EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
      expect(verifyTicketPostcondition(200, EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
    });

    it("an empty object (schema-invalid response)", () => {
      expect(verifyTicketPostcondition({}, EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
    });

    it("status other than 'open', however the adapter narrated it", () => {
      expect(verifyTicketPostcondition(validReceipt({ status: "ok" }), EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
      expect(verifyTicketPostcondition(validReceipt({ status: "success" }), EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
    });

    it("a missing/empty ticketId, even with every other field correct", () => {
      expect(verifyTicketPostcondition(validReceipt({ ticketId: "" }), EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
      const { ticketId: _ticketId, ...withoutTicketId } = validReceipt();
      expect(verifyTicketPostcondition(withoutTicketId, EXPECTED)).toEqual({ ok: false, reasonCode: "INVALID_TOOL_OUTPUT" });
    });
  });

  describe("POSTCONDITION_FAILED (w4-030): well-formed, but for a different operation than the one actually asked for", () => {
    it("a receipt for a DIFFERENT idempotency key does not prove THIS operation succeeded, however well-formed", () => {
      expect(verifyTicketPostcondition(validReceipt({ idempotencyKey: "idem_SOMEONE_ELSE" }), EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
    });

    it("a receipt whose title does not match what was actually asked for", () => {
      expect(verifyTicketPostcondition(validReceipt({ title: "an entirely different ticket" }), EXPECTED)).toEqual({ ok: false, reasonCode: "POSTCONDITION_FAILED" });
    });
  });
});
