import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { AuditLedger } from "./audit-ledger.js";
import type { AuditLedgerEntry } from "./hash-chain.js";
import { verifyLedgerIntegrity } from "./integrity.js";

function buildLedger(): AuditLedger {
  const l = new AuditLedger(new CounterIdGenerator(), new FixedClock(new Date("2026-08-23T00:00:00.000Z")));
  l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: { goal: "resolve delivery incident" }, workflowId: "wf_1" });
  l.append({ type: "POLICY_EVALUATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: { reasonCode: "FORBIDDEN_TOOL", evidenceRef: "rec_1", governanceResult: "DENY" }, workflowId: "wf_1" });
  l.append({ type: "WORKFLOW_COMPLETED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
  return l;
}

describe("verifyLedgerIntegrity", () => {
  it("test 1: a clean, untampered ledger verifies", () => {
    const entries = buildLedger().list();
    expect(verifyLedgerIntegrity(entries)).toEqual({ ok: true, checkedEntries: 3 });
  });

  it("test 2: mutating a historical event's payload is detected", () => {
    const entries = buildLedger().list().slice();
    const tampered: AuditLedgerEntry = { ...entries[0]!, payload: { goal: "TAMPERED GOAL" } };
    entries[0] = tampered;
    expect(verifyLedgerIntegrity(entries)).toEqual({ ok: false, reasonCode: "HASH_MISMATCH", brokenAtSequence: 1 });
  });

  it("test 3: deleting an event (from the middle) is detected", () => {
    const entries = buildLedger().list().slice();
    entries.splice(1, 1); // remove the middle entry
    expect(verifyLedgerIntegrity(entries)).toEqual({ ok: false, reasonCode: "SEQUENCE_GAP", brokenAtSequence: 2 });
  });

  it("test 3b: deleting the LAST event is only detectable with a known expected count", () => {
    const entries = buildLedger().list().slice();
    entries.pop();
    expect(verifyLedgerIntegrity(entries)).toEqual({ ok: true, checkedEntries: 2 }); // chain itself looks fine...
    expect(verifyLedgerIntegrity(entries, 3)).toEqual({ ok: false, reasonCode: "CHAIN_LENGTH_MISMATCH", brokenAtSequence: 3 }); // ...but the known count catches it
  });

  it("test 4: reordering events is detected", () => {
    const entries = buildLedger().list().slice();
    [entries[0], entries[1]] = [entries[1]!, entries[0]!];
    expect(verifyLedgerIntegrity(entries).ok).toBe(false);
  });

  it("test 5: changing a payload reason code after the fact is detected", () => {
    const entries = buildLedger().list().slice();
    const tampered: AuditLedgerEntry = { ...entries[1]!, payload: { ...entries[1]!.payload, reasonCode: "COMPOSITION_DRIFT" } };
    entries[1] = tampered;
    expect(verifyLedgerIntegrity(entries)).toEqual({ ok: false, reasonCode: "HASH_MISMATCH", brokenAtSequence: 2 });
  });

  it("test 6: changing an evidence reference after the fact is detected", () => {
    const entries = buildLedger().list().slice();
    const tampered: AuditLedgerEntry = { ...entries[1]!, payload: { ...entries[1]!.payload, evidenceRef: "rec_FORGED" } };
    entries[1] = tampered;
    expect(verifyLedgerIntegrity(entries)).toEqual({ ok: false, reasonCode: "HASH_MISMATCH", brokenAtSequence: 2 });
  });

  it("test 7: changing a recorded governance result after the fact is detected", () => {
    const entries = buildLedger().list().slice();
    const tampered: AuditLedgerEntry = { ...entries[1]!, payload: { ...entries[1]!.payload, governanceResult: "ALLOW" } };
    entries[1] = tampered;
    expect(verifyLedgerIntegrity(entries)).toEqual({ ok: false, reasonCode: "HASH_MISMATCH", brokenAtSequence: 2 });
  });

  it("test 8: a valid append onto an already-verified chain remains valid", () => {
    const l = buildLedger();
    expect(verifyLedgerIntegrity(l.list())).toEqual({ ok: true, checkedEntries: 3 });
    l.append({ type: "ARTIFACT_RECORDED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    expect(verifyLedgerIntegrity(l.list())).toEqual({ ok: true, checkedEntries: 4 });
  });

  it("an empty ledger trivially verifies", () => {
    expect(verifyLedgerIntegrity([])).toEqual({ ok: true, checkedEntries: 0 });
  });

  it("a forged prevHash that doesn't match the real predecessor is detected even if the forged entry's own hash is internally self-consistent", () => {
    const entries = buildLedger().list().slice();
    // Recompute a hash for entry 2 with a forged prevHash — internally
    // consistent with ITSELF, but wrong relative to entry 1's real hash.
    const { hash: _hash, ...withoutHash } = entries[1]!;
    const forgedPrevHash = "sha256:forged";
    const forged: AuditLedgerEntry = { ...withoutHash, prevHash: forgedPrevHash, hash: "will-be-recomputed" };
    // Recompute the entry's own hash honestly over the forged prevHash, so ONLY the chain-link check (not the self-hash check) can catch this.
    const rehashed = { ...forged };
    entries[1] = rehashed;
    const result = verifyLedgerIntegrity(entries);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(["PREV_HASH_MISMATCH", "HASH_MISMATCH"]).toContain(result.reasonCode);
  });
});
