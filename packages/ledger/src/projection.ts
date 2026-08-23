import type { AuditEventType } from "@controldeck/contracts";
import type { AuditLedgerEntry } from "./hash-chain.js";

/** "Project at minimum: proposal, evidence, governance, approval, execution, verification, final outcome." */
export type ProjectionStage = "proposal" | "evidence" | "governance" | "approval" | "execution" | "verification" | "outcome";

export type WorkflowOutcome = "IN_PROGRESS" | "COMPLETE" | "BLOCKED" | "PAUSED";

export interface WorkflowProjection {
  readonly workflowId: string;
  readonly stagesSeen: readonly ProjectionStage[];
  readonly outcome: WorkflowOutcome;
  readonly events: readonly AuditLedgerEntry[];
}

function stageForEventType(type: AuditEventType): ProjectionStage | undefined {
  switch (type) {
    case "PLANNER_STARTED":
    case "PLAN_PROPOSED":
    case "PLANNER_FAILED":
    case "ACTION_PROPOSED":
    case "GATEWAY_SUBMISSION":
      return "proposal";
    case "RESEARCH_STARTED":
    case "EVIDENCE_RETURNED":
    case "EVIDENCE_ASSESSED":
    case "EVIDENCE_INSUFFICIENT":
      return "evidence";
    case "POLICY_EVALUATED":
      return "governance";
    case "APPROVAL_GRANTED":
    case "APPROVAL_REJECTED":
    case "APPROVAL_EXPIRED":
      return "approval";
    case "CAPABILITY_MINTED":
    case "ACTION_EXECUTED":
      return "execution";
    case "VERIFICATION_STARTED":
    case "VERIFICATION_REPORTED":
    case "POSTCONDITION_VERIFIED":
      return "verification";
    case "WORKFLOW_COMPLETED":
      return "outcome";
    case "WORKFLOW_CREATED":
    case "AGENT_STARTED":
    case "ARTIFACT_RECORDED":
    case "INVARIANT_VIOLATED":
    case "RETRY_EXHAUSTED":
      return undefined;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

function outcomeForEventType(type: AuditEventType, previous: WorkflowOutcome): WorkflowOutcome {
  switch (type) {
    case "WORKFLOW_COMPLETED":
      return "COMPLETE";
    case "INVARIANT_VIOLATED":
      return "BLOCKED";
    case "RETRY_EXHAUSTED":
      return "PAUSED";
    case "WORKFLOW_CREATED":
    case "AGENT_STARTED":
    case "ARTIFACT_RECORDED":
    case "PLANNER_STARTED":
    case "PLAN_PROPOSED":
    case "PLANNER_FAILED":
    case "RESEARCH_STARTED":
    case "EVIDENCE_RETURNED":
    case "EVIDENCE_ASSESSED":
    case "EVIDENCE_INSUFFICIENT":
    case "ACTION_PROPOSED":
    case "GATEWAY_SUBMISSION":
    case "VERIFICATION_STARTED":
    case "VERIFICATION_REPORTED":
    case "POLICY_EVALUATED":
    case "APPROVAL_GRANTED":
    case "APPROVAL_REJECTED":
    case "APPROVAL_EXPIRED":
    case "CAPABILITY_MINTED":
    case "ACTION_EXECUTED":
    case "POSTCONDITION_VERIFIED":
      return previous;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}

/**
 * Deterministically reconstructs a workflow's lifecycle by folding, in
 * sequence order, over its own already-recorded ledger entries. "Replay
 * means: reconstruct state from recorded events. It must NOT mean: rerun
 * agents, rerun prompts, regenerate history." This is a pure read of
 * history — nothing here calls a model, an adapter, or any other side
 * effect; it cannot, because it never receives anything capable of one
 * (its only input is `readonly AuditLedgerEntry[]`, already-recorded
 * server-authored data).
 */
export function projectWorkflow(entries: readonly AuditLedgerEntry[], workflowId: string): WorkflowProjection {
  const relevant = entries
    .filter((entry) => entry.workflowId === workflowId)
    .slice()
    .sort((a, b) => a.sequence - b.sequence);

  const stages = new Set<ProjectionStage>();
  let outcome: WorkflowOutcome = "IN_PROGRESS";

  for (const entry of relevant) {
    const stage = stageForEventType(entry.type);
    if (stage !== undefined) stages.add(stage);
    outcome = outcomeForEventType(entry.type, outcome);
  }

  return { workflowId, stagesSeen: [...stages], outcome, events: relevant };
}
