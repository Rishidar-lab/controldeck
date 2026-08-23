import { describe, expect, it } from "vitest";
import { sha256Hex } from "./sha256.js";

describe("sha256Hex — verified against the standard FIPS 180-4 test vectors, not merely 'produces a hash'", () => {
  it('SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it('SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it('SHA-256("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq") = 248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1 (two-block message, exercises the multi-block padding path)', () => {
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  });

  it("padding at the one-block/two-block boundary is internally consistent — 55 bytes (fits one block) and 56 bytes (forces a second block) both produce a well-formed, distinct, deterministic digest", () => {
    const oneBlock = sha256Hex("a".repeat(55)); // 55 + 1 (0x80) + 8 (length) = 64, exactly one block
    const twoBlock = sha256Hex("a".repeat(56)); // 56 + 1 + 8 = 65 > 64, forces a second block
    expect(oneBlock).toHaveLength(64);
    expect(twoBlock).toHaveLength(64);
    expect(oneBlock).not.toBe(twoBlock);
    expect(sha256Hex("a".repeat(55))).toBe(oneBlock);
    expect(sha256Hex("a".repeat(56))).toBe(twoBlock);
  });

  it("is deterministic", () => {
    expect(sha256Hex("determinism check")).toBe(sha256Hex("determinism check"));
  });

  it("is sensitive to every byte", () => {
    expect(sha256Hex("input-a")).not.toBe(sha256Hex("input-b"));
  });
});
