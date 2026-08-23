import { describe, expect, it } from "vitest";
import { canonicalize, hashCanonical } from "./hash.js";

describe("canonicalize", () => {
  it("sorts object keys so key order does not affect the resulting structure", () => {
    expect(canonicalize({ b: 1, a: 2 })).toEqual({ a: 2, b: 1 });
    expect(JSON.stringify(canonicalize({ b: 1, a: 2 }))).toBe(JSON.stringify(canonicalize({ a: 2, b: 1 })));
  });

  it("recurses into arrays and nested objects", () => {
    expect(canonicalize({ list: [{ z: 1, a: 2 }] })).toEqual({ list: [{ a: 2, z: 1 }] });
  });

  it("rejects undefined fields rather than silently dropping them", () => {
    expect(() => canonicalize({ a: undefined })).toThrow(TypeError);
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalize(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalize(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });

  it("rejects non-JSON values", () => {
    expect(() => canonicalize(() => {})).toThrow(TypeError);
    expect(() => canonicalize(Symbol("x"))).toThrow(TypeError);
    expect(() => canonicalize(10n)).toThrow(TypeError);
  });
});

describe("hashCanonical", () => {
  it("is deterministic regardless of key order", () => {
    expect(hashCanonical({ b: 1, a: 2 })).toBe(hashCanonical({ a: 2, b: 1 }));
  });

  it("changes when content changes", () => {
    expect(hashCanonical({ a: 1 })).not.toBe(hashCanonical({ a: 2 }));
  });

  it("is prefixed with sha256: for legibility and future-proofing against algorithm changes", () => {
    expect(hashCanonical({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
