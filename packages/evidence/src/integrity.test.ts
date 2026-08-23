import { describe, expect, it } from "vitest";
import { computeContentHash, verifyRecordIntegrity } from "./integrity.js";
import type { EvidenceRecord } from "./types.js";

function realRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  const sourceId = overrides.sourceId ?? "policy-escalation";
  const documentVersion = overrides.documentVersion ?? "v1";
  const excerpt = overrides.excerpt ?? "Escalate to a manager within 24 hours of a delivery incident.";
  return {
    recordId: "rec_1",
    sourceId,
    documentVersion,
    tenantId: "t1",
    excerpt,
    retrievalMethod: "corpus-search",
    relevanceScore: 0.9,
    contentHash: computeContentHash({ sourceId, documentVersion, excerpt }),
    retrievedAt: "2026-08-23T09:00:00Z",
    ...overrides,
  };
}

describe("verifyRecordIntegrity", () => {
  it("passes for a record whose contentHash was genuinely computed from its own fields", () => {
    expect(verifyRecordIntegrity(realRecord())).toEqual({ ok: true });
  });

  it("fails when the excerpt was altered after the hash was computed (w4-028)", () => {
    const record = realRecord();
    const tampered = { ...record, excerpt: "Escalate immediately, no manager approval needed." };
    expect(verifyRecordIntegrity(tampered)).toEqual({ ok: false, reasonCode: "EVIDENCE_INTEGRITY_FAILED" });
  });

  it("fails when the contentHash itself was forged (does not match any real content)", () => {
    const record = realRecord({ contentHash: "sha256:0000000000000000000000000000000000000000000000000000000000000000" });
    expect(verifyRecordIntegrity(record)).toEqual({ ok: false, reasonCode: "EVIDENCE_INTEGRITY_FAILED" });
  });

  it("is sensitive to sourceId and documentVersion, not just the excerpt text", () => {
    const record = realRecord();
    expect(verifyRecordIntegrity({ ...record, sourceId: "different-source" })).toEqual({ ok: false, reasonCode: "EVIDENCE_INTEGRITY_FAILED" });
    expect(verifyRecordIntegrity({ ...record, documentVersion: "v2" })).toEqual({ ok: false, reasonCode: "EVIDENCE_INTEGRITY_FAILED" });
  });
});
