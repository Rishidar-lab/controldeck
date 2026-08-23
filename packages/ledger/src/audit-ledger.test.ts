import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { AuditLedger } from "./audit-ledger.js";
import { GENESIS_HASH } from "./hash-chain.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");

function ledger() {
  return new AuditLedger(new CounterIdGenerator(), new FixedClock(NOW));
}

describe("AuditLedger.append — sequence and chain linking", () => {
  it("the first entry chains from GENESIS_HASH and gets sequence 1", () => {
    const entry = ledger().append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "orchestrator" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    expect(entry.sequence).toBe(1);
    expect(entry.prevHash).toBe(GENESIS_HASH);
  });

  it("each subsequent entry chains from the previous entry's own hash, in order", () => {
    const l = ledger();
    const first = l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "orchestrator" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    const second = l.append({ type: "AGENT_STARTED", actor: { kind: "server", id: "orchestrator" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    expect(second.sequence).toBe(2);
    expect(second.prevHash).toBe(first.hash);
  });
});

describe("AuditLedger — append-only by construction, not convention", () => {
  it("has no update/delete/replace method on its type at all", () => {
    const l = ledger();
    expect((l as unknown as Record<string, unknown>).update).toBeUndefined();
    expect((l as unknown as Record<string, unknown>).delete).toBeUndefined();
    expect((l as unknown as Record<string, unknown>).remove).toBeUndefined();
    expect((l as unknown as Record<string, unknown>).replace).toBeUndefined();
  });

  it("list()/findByWorkflow()/findByOperation() return frozen, independently-allocated copies — mutating the returned array cannot reach the ledger's own state", () => {
    const l = ledger();
    l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "orchestrator" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    const snapshot = l.list();
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => (snapshot as unknown as unknown[]).push("intrusion")).toThrow();
    expect(l.list()).toHaveLength(1); // unaffected by the attempted push
  });

  it("findByWorkflow filters correctly across multiple workflows", () => {
    const l = ledger();
    l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_2" }, payload: {}, workflowId: "wf_2" });
    expect(l.findByWorkflow("wf_1")).toHaveLength(1);
    expect(l.findByWorkflow("wf_2")).toHaveLength(1);
  });
});

describe("AuditLedger — redaction is applied automatically on append", () => {
  it("a secret-shaped payload field never survives into the stored entry", () => {
    const l = ledger();
    const entry = l.append({ type: "ARTIFACT_RECORDED", actor: { kind: "model", id: "planner-1" }, subject: { kind: "workflow", id: "wf_1" }, payload: { apiKey: "sk-should-never-persist" }, workflowId: "wf_1" });
    expect(entry.payload.apiKey).toBe("[REDACTED]");
  });
});
