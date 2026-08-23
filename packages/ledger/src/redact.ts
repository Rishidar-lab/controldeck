/**
 * Deterministic redaction for ledger `payload` content ONLY — structural
 * entry fields (`eventId`, `operationId`, `workflowId`, `prevHash`,
 * `hash`, and any hash/id embedded in payload under a non-secret-shaped
 * key such as `payloadHash`/`capabilityId`) are evidence, not secrets,
 * and are never passed through this module: redacting those would break
 * the hash chain's evidentiary value while buying no real confidentiality.
 *
 * Detection is key-name-based (a fixed deny-list of credential-shaped key
 * names) PLUS two narrow value-shape checks (`Bearer <token>`, JWT-shaped
 * `xxx.yyy.zzz`) that catch a credential landing under an innocuous key
 * name. Deliberately does NOT redact "any long opaque string" — that
 * would also catch this ledger's own `sha256:...` hashes and
 * `evt_`/`cap_`/`op_` ids, exactly the fields Gate 8's integrity story
 * depends on.
 */
export const REDACTED = "[REDACTED]";

const SECRET_KEY_PATTERN = /token|secret|password|passwd|api[_-]?key|credential|bearer|authorization|private[_-]?key|access[_-]?key/i;
const BEARER_VALUE_PATTERN = /^bearer\s+\S+/i;
const JWT_VALUE_PATTERN = /^eyj[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+$/i;

function isSecretShapedValue(value: string): boolean {
  return BEARER_VALUE_PATTERN.test(value) || JWT_VALUE_PATTERN.test(value);
}

export function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    return SECRET_KEY_PATTERN.test(key) || isSecretShapedValue(value) ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item));
  }
  if (value !== null && typeof value === "object") {
    return redactPayload(value as Record<string, unknown>);
  }
  return value;
}

/** Applied to every `AuditEventInput.payload` before it is written into the ledger. */
export function redactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    result[key] = redactValue(key, value);
  }
  return result;
}
