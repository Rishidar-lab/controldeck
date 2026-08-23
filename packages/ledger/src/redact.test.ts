import { describe, expect, it } from "vitest";
import { redactPayload, REDACTED } from "./redact.js";

describe("redactPayload — representative secret-shaped strings never persist", () => {
  it("credential-shaped key names are redacted regardless of value", () => {
    const result = redactPayload({ apiKey: "sk-live-abcdef1234567890", password: "hunter2", token: "raw-token-value", secret: "shh", credential: "x", authorization: "y", accessKey: "z", privateKey: "w" });
    for (const value of Object.values(result)) {
      expect(value).toBe(REDACTED);
    }
  });

  it("a Bearer-shaped value is redacted even under an innocuous key name", () => {
    const result = redactPayload({ note: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGVzdC1zaWduYXR1cmU" });
    expect(result.note).toBe(REDACTED);
  });

  it("a JWT-shaped value is redacted even under an innocuous key name", () => {
    const result = redactPayload({ comment: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dGVzdC1zaWduYXR1cmU" });
    expect(result.comment).toBe(REDACTED);
  });

  it("secret-shaped values nested inside arrays/objects are still redacted", () => {
    const result = redactPayload({ headers: { Authorization: "Bearer abc.def.ghi" }, notes: ["fine", "api_key=should-still-be-caught-by-key-not-value"] });
    expect(result.headers).toEqual({ Authorization: REDACTED });
  });

  it("does NOT redact non-secret evidence fields — hashes, ids, and ordinary text pass through unchanged", () => {
    const result = redactPayload({ payloadHash: "sha256:abcd1234", capabilityId: "cap_1", reasonCode: "FORBIDDEN_TOOL", title: "customer reports delayed delivery" });
    expect(result).toEqual({ payloadHash: "sha256:abcd1234", capabilityId: "cap_1", reasonCode: "FORBIDDEN_TOOL", title: "customer reports delayed delivery" });
  });
});
