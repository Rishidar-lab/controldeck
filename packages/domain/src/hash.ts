import { createHash } from "node:crypto";

export type Canonical = null | boolean | string | number | readonly Canonical[] | { readonly [key: string]: Canonical };

/**
 * Deterministic canonical-JSON walk: sorts object keys so two logically
 * identical objects built in different key orders hash identically.
 * Throws on anything that would make the hash ambiguous: `undefined`,
 * non-finite numbers, and non-JSON values (functions, symbols, bigints).
 */
export function canonicalize(value: unknown): Canonical {
  if (value === null) return null;
  if (typeof value === "boolean" || typeof value === "string") return value;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`canonicalize: non-finite number is not hashable (${String(value)})`);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const sortedKeys = Object.keys(input).sort();
    const result: Record<string, Canonical> = {};
    for (const key of sortedKeys) {
      const propertyValue = input[key];
      if (propertyValue === undefined) {
        throw new TypeError(`canonicalize: field "${key}" is undefined; omit it explicitly instead`);
      }
      result[key] = canonicalize(propertyValue);
    }
    return result;
  }

  throw new TypeError(`canonicalize: unsupported value of type ${typeof value}`);
}

function sha256Hex(input: string): string {
  return `sha256:${createHash("sha256").update(input, "utf8").digest("hex")}`;
}

/** Deterministic hash of any canonicalizable value — used for snapshot ids, plan/evidence/action hashes, and (Gate 8) audit event hashing. */
export function hashCanonical(value: unknown): string {
  return sha256Hex(JSON.stringify(canonicalize(value)));
}
