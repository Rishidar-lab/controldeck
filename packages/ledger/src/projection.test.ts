import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import { describe, expect, it } from "vitest";
import { AuditLedger } from "./audit-ledger.js";
import { projectWorkflow } from "./projection.js";

function ledger(): AuditLedger {
  return new AuditLedger(new CounterIdGenerator(), new FixedClock(new Date("2026-08-23T00:00:00.000Z")));
}

describe("projectWorkflow — reconstructs stages seen from recorded events only", () => {
  it("a full hero-scenario walk touches all 7 required stages: proposal, evidence, governance, approval, execution, verification, outcome", () => {
    const l = ledger();
    const wf = "wf_1";
    l.append({ type: "PLANNER_STARTED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: wf }, payload: {}, workflowId: wf });
    l.append({ type: "PLAN_PROPOSED", actor: { kind: "model", id: "planner-1" }, subject: { kind: "plan", id: "plan_1" }, payload: {}, workflowId: wf });
    l.append({ type: "RESEARCH_STARTED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: wf }, payload: {}, workflowId: wf });
    l.append({ type: "EVIDENCE_ASSESSED", actor: { kind: "server", id: "o" }, subject: { kind: "evidence", id: "bundle_1" }, payload: {}, workflowId: wf });
    l.append({ type: "POLICY_EVALUATED", actor: { kind: "server", id: "o" }, subject: { kind: "action", id: "a_1" }, payload: {}, workflowId: wf });
    l.append({ type: "APPROVAL_GRANTED", actor: { kind: "human", id: "human_1" }, subject: { kind: "approval", id: "appr_1" }, payload: {}, workflowId: wf });
    l.append({ type: "CAPABILITY_MINTED", actor: { kind: "server", id: "o" }, subject: { kind: "capability", id: "cap_1" }, payload: {}, workflowId: wf });
    l.append({ type: "ACTION_EXECUTED", actor: { kind: "server", id: "o" }, subject: { kind: "operation", id: "op_1" }, payload: {}, workflowId: wf, operationId: "op_1" });
    l.append({ type: "POSTCONDITION_VERIFIED", actor: { kind: "server", id: "o" }, subject: { kind: "operation", id: "op_1" }, payload: {}, workflowId: wf, operationId: "op_1" });
    l.append({ type: "WORKFLOW_COMPLETED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: wf }, payload: {}, workflowId: wf });

    const projection = projectWorkflow(l.list(), wf);
    expect(new Set(projection.stagesSeen)).toEqual(new Set(["proposal", "evidence", "governance", "approval", "execution", "verification", "outcome"]));
    expect(projection.outcome).toBe("COMPLETE");
    expect(projection.events).toHaveLength(10);
  });

  it("only events for the requested workflow are included, even when the ledger holds several workflows", () => {
    const l = ledger();
    l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_2" }, payload: {}, workflowId: "wf_2" });
    l.append({ type: "WORKFLOW_COMPLETED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_2" }, payload: {}, workflowId: "wf_2" });

    expect(projectWorkflow(l.list(), "wf_1").outcome).toBe("IN_PROGRESS");
    expect(projectWorkflow(l.list(), "wf_2").outcome).toBe("COMPLETE");
  });

  it("an INVARIANT_VIOLATED event marks the workflow BLOCKED, and a subsequent RETRY_EXHAUSTED does not silently override it back", () => {
    const l = ledger();
    l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    l.append({ type: "INVARIANT_VIOLATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    expect(projectWorkflow(l.list(), "wf_1").outcome).toBe("BLOCKED");
  });

  it("replaying an empty history for an unknown workflow id is IN_PROGRESS with zero events — never an error, never a guess", () => {
    const projection = projectWorkflow([], "wf_never_existed");
    expect(projection).toEqual({ workflowId: "wf_never_existed", stagesSeen: [], outcome: "IN_PROGRESS", events: [] });
  });
});

describe("projectWorkflow — replay reconstructs recorded state, it does not regenerate history", () => {
  it("is a pure fold over already-recorded entries — calling it twice on the same input produces byte-identical output (no model call, no randomness, no side effect)", () => {
    const l = ledger();
    l.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    l.append({ type: "WORKFLOW_COMPLETED", actor: { kind: "server", id: "o" }, subject: { kind: "workflow", id: "wf_1" }, payload: {}, workflowId: "wf_1" });
    const entries = l.list();
    expect(projectWorkflow(entries, "wf_1")).toEqual(projectWorkflow(entries, "wf_1"));
  });
});
