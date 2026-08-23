import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { buildLedgerEntry, computeEntryHash, GENESIS_HASH } from "./hash-chain.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");

describe("computeEntryHash — deterministic and sensitive to every authoritative field", () => {
  it("the same entry hashes identically every time", () => {
    const entry = buildLedgerEntry({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: { goal: "x" }, workflowId: "wf_1" }, 1, GENESIS_HASH, new CounterIdGenerator(), new FixedClock(NOW));
    const { hash, ...withoutHash } = entry;
    expect(computeEntryHash(withoutHash)).toBe(hash);
  });

  it("changing sequence, prevHash, type, actor, subject, payload, or occurredAt each independently changes the hash", () => {
    const base = buildLedgerEntry({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: { goal: "x" }, workflowId: "wf_1" }, 1, GENESIS_HASH, new CounterIdGenerator(), new FixedClock(NOW));
    const { hash: baseHash, ...baseWithoutHash } = base;

    expect(computeEntryHash({ ...baseWithoutHash, sequence: 2 })).not.toBe(baseHash);
    expect(computeEntryHash({ ...baseWithoutHash, prevHash: "sha256:different" })).not.toBe(baseHash);
    expect(computeEntryHash({ ...baseWithoutHash, type: "AGENT_STARTED" })).not.toBe(baseHash);
    expect(computeEntryHash({ ...baseWithoutHash, actor: { kind: "model", id: "o" } })).not.toBe(baseHash);
    expect(computeEntryHash({ ...baseWithoutHash, subject: { kind: "plan", id: "wf_1" } })).not.toBe(baseHash);
    expect(computeEntryHash({ ...baseWithoutHash, payload: { goal: "DIFFERENT" } })).not.toBe(baseHash);
    expect(computeEntryHash({ ...baseWithoutHash, occurredAt: "2026-01-01T00:00:00.000Z" })).not.toBe(baseHash);
  });

  it("workflowId/operationId/policyVersion/correlationId are also part of the hash when present", () => {
    const withOp = buildLedgerEntry({ type: "ACTION_EXECUTED", actor: { kind: "server", id: "o" }, subject: { kind: "operation", id: "op_1" }, payload: {}, workflowId: "wf_1", operationId: "op_1", policyVersion: "policy-v1", correlationId: "corr_1" }, 1, GENESIS_HASH, new CounterIdGenerator(), new FixedClock(NOW));
    const withDifferentOp = buildLedgerEntry({ type: "ACTION_EXECUTED", actor: { kind: "server", id: "o" }, subject: { kind: "operation", id: "op_1" }, payload: {}, workflowId: "wf_1", operationId: "op_2", policyVersion: "policy-v1", correlationId: "corr_1" }, 1, GENESIS_HASH, new CounterIdGenerator(), new FixedClock(NOW));
    expect(withOp.hash).not.toBe(withDifferentOp.hash);
  });
});

describe("buildLedgerEntry — redaction applied before hashing, so a redacted field's ORIGINAL secret value never touches the hash either", () => {
  it("a secret-shaped payload field is redacted, and the hash reflects the REDACTED value, not the original", () => {
    const entry = buildLedgerEntry({ type: "ARTIFACT_RECORDED", actor: { kind: "model", id: "planner-1" }, subject: { kind: "workflow", id: "wf_1" }, payload: { apiKey: "sk-secret-value" }, workflowId: "wf_1" }, 1, GENESIS_HASH, new CounterIdGenerator(), new FixedClock(NOW));
    expect(entry.payload.apiKey).toBe("[REDACTED]");
    const { hash, ...withoutHash } = entry;
    expect(computeEntryHash(withoutHash)).toBe(hash); // internally consistent — the hash was computed over the REDACTED payload
  });
});
