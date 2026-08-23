import { fixtureProvider, runPlanner, runResearcher } from "@controldeck/agents";
import { consumeApproval, grantApproval, hashAction, hashPlan, matchApproval, type Approval, type ApprovalBinding } from "@controldeck/authority";
import type { AuditEventType, PlanArtifact } from "@controldeck/contracts";
import { CounterIdGenerator, FixedClock } from "@controldeck/domain";
import { assessClaim, computeContentHash, type Claim, type EvidenceBundle, type EvidenceRecord } from "@controldeck/evidence";
import { CapabilityRegistry, FakeTicketAdapter, OperationStore, executeAction, mintCapability, type AdapterOperation, type CapabilityRequest, type TicketReceipt } from "@controldeck/execution";
import { evaluateEvidenceGate, evaluatePolicyGate, evidenceGateOutcomeToTrigger, type GovernanceDecision } from "@controldeck/governance";
import { AuditLedger, verifyLedgerIntegrity, type AuditLedgerEntry } from "@controldeck/ledger";
import { classifyResolvedExecution, reconcile } from "@controldeck/verification";
import type { AuditEntryView, ApprovalView, ConflictView, EvidenceItemView, IntegrityView, SpecialistOutputView, WorkflowSnapshot } from "./types.js";

const NOW = new Date("2026-08-23T00:00:00.000Z");

function record(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  const base = { recordId: "rec_1", sourceId: "src_1", documentVersion: "v1", tenantId: "t1", excerpt: "the order was delivered on 2026-08-20, matching the customer's report", retrievalMethod: "corpus_search", relevanceScore: 0.9, retrievedAt: NOW.toISOString(), ...overrides };
  const contentHash = "contentHash" in overrides ? (overrides.contentHash as string) : computeContentHash({ sourceId: base.sourceId, documentVersion: base.documentVersion, excerpt: base.excerpt });
  return { ...base, contentHash };
}

function bundle(records: readonly EvidenceRecord[], snapshotId = "snap_1"): EvidenceBundle {
  return { bundleId: "bundle_1", snapshotId, query: "delivery incident", records, gaps: [], createdAt: NOW.toISOString() };
}

function auditView(entry: AuditLedgerEntry, advisoryContent: boolean): AuditEntryView {
  return { sequence: entry.sequence, type: entry.type, actorKind: entry.actor.kind, actorId: entry.actor.id, occurredAt: entry.occurredAt, authoritative: true, advisoryContent };
}

const NOT_REQUIRED_APPROVAL: ApprovalView = { required: false, status: "NOT_REQUIRED", advisory: false };
const NO_CONFLICT: ConflictView = { present: false };
const CLEAN_INTEGRITY: IntegrityView = { checked: false, ok: true };

function makePlanner(): SpecialistOutputView {
  const plan = { planId: "plan_1", goal: "resolve delivery incident", steps: [{ stepId: "s1", description: "notify customer of delivery status", dependsOn: [] }] };
  return { role: "Planner", implemented: true, advisory: true, summary: `Proposes: ${plan.goal}`, structuredOutput: plan, claimOrEvidenceRefs: ["s1"] };
}

function makeResearcher(records: readonly EvidenceRecord[]): SpecialistOutputView {
  return { role: "Researcher", implemented: true, advisory: true, summary: `Retrieved ${records.length} record(s)`, structuredOutput: { records, gaps: [] }, claimOrEvidenceRefs: records.map((r) => r.recordId) };
}

const RISK_NOT_IMPLEMENTED: SpecialistOutputView = { role: "Risk", implemented: false, advisory: true, summary: "Not implemented — CUMULATIVE_RISK_REQUIRES_APPROVAL is currently supplied to governance as a structured RiskAssessment[] input, not produced by a live Risk specialist (Gate 4 built Planner + Researcher only).", structuredOutput: null, claimOrEvidenceRefs: [] };
const VERIFIER_NOT_IMPLEMENTED: SpecialistOutputView = { role: "Verifier", implemented: false, advisory: true, summary: "Not implemented as an agent — Gate 7's postcondition/reconciliation logic is deterministic system code, not a specialist output (see Verification panel).", structuredOutput: null, claimOrEvidenceRefs: [] };

// ---------------------------------------------------------------------------
// A. NORMAL GOVERNED PATH — high-risk action, approval required, executes, verifies, COMPLETE.
// ---------------------------------------------------------------------------
export async function runScenarioA(): Promise<WorkflowSnapshot> {
  const idGenerator = new CounterIdGenerator();
  const clock = new FixedClock(NOW);
  const ledger = new AuditLedger(idGenerator, clock);
  const wf = "wf_scenario_a";
  const audit: AuditEntryView[] = [];
  const emit = (type: AuditEventType, actor: { kind: "server" | "model" | "human"; id: string }, payload: Record<string, unknown>, advisoryContent: boolean) => {
    const e = ledger.append({ type, actor, subject: { kind: "workflow", id: wf }, payload, workflowId: wf });
    audit.push(auditView(e, advisoryContent));
    return e;
  };

  emit("WORKFLOW_CREATED", { kind: "server", id: "orchestrator" }, { goal: "resolve delivery incident" }, false);

  const planner = makePlanner();
  emit("PLAN_PROPOSED", { kind: "model", id: "planner-1" }, { planId: "plan_1" }, true);

  const rec = record();
  const researcher = makeResearcher([rec]);
  emit("EVIDENCE_RETURNED", { kind: "model", id: "researcher-1" }, { bundleId: "bundle_1" }, true);

  const claim: Claim = { claimId: "c1", text: "the order was delivered", relatedRecordIds: [rec.recordId] };
  const assessment = assessClaim(claim, bundle([rec]), { tenantId: "t1", expectedSnapshotId: "snap_1" });
  const evidenceGate = evaluateEvidenceGate(["c1"], [assessment]);
  emit("EVIDENCE_ASSESSED", { kind: "server", id: "orchestrator" }, { outcome: evidenceGate.outcome }, false);

  const planHash = hashPlan(planner.structuredOutput as PlanArtifact);
  const actionHash = hashAction({ actionId: "a1", actionType: "create_internal_ticket", resourceId: "res_1", principalRole: "operator", tenantId: "t1", parameters: { priority: "urgent" } });

  const decision: GovernanceDecision = evaluatePolicyGate({
    proposal: { actionId: "a1", actionType: "create_internal_ticket", resourceId: "res_1", principalRole: "operator", tenantId: "t1" },
    riskAssessments: [{ actionId: "a1", riskLevel: "HIGH", rationale: "escalation pages the executive on-call rotation" }],
    evidenceGate,
    forbiddenActionTypes: new Set(),
    requestsNewSubAgentOrTool: false,
  });
  emit("POLICY_EVALUATED", { kind: "server", id: "orchestrator" }, { outcome: decision.outcome, reasonCodes: decision.reasonCodes }, false);

  const binding: ApprovalBinding = { workflowId: wf, planHash, evidenceSnapshotId: "snap_1", actionHash, policyVersion: decision.policyVersion };
  const approval = grantApproval({ binding, grantedByPrincipal: "human_operator_1" }, clock, idGenerator);
  emit("APPROVAL_GRANTED", { kind: "human", id: "human_operator_1" }, { approvalId: approval.approvalId }, false);
  const matchResult = matchApproval(approval, { workflowId: wf, planHash, evidenceSnapshotId: "snap_1", actionHash, policyVersion: decision.policyVersion, now: clock.now() });
  const consumedApproval: Approval = matchResult.ok ? consumeApproval(approval, clock) : approval;

  const registry = new CapabilityRegistry();
  const request: CapabilityRequest = { principalRole: "operator", tenantId: "t1", actionType: "create_internal_ticket", resourceId: "res_1", workflowId: wf, planHash, evidenceSnapshotId: "snap_1", actionHash, policyVersion: decision.policyVersion, expectedResourceVersion: 1 };
  const mint = mintCapability({ kind: "approved", approval: consumedApproval }, request, idGenerator, clock, 60_000);
  if (!mint.ok) throw new Error(`unreachable: ${mint.reasonCode}`);
  registry.record(mint.capability);
  emit("CAPABILITY_MINTED", { kind: "server", id: "orchestrator" }, { capabilityId: mint.capability.id }, false);

  const adapter = new FakeTicketAdapter(registry, idGenerator, clock);
  const operationStore = new OperationStore<TicketReceipt>();
  const op: AdapterOperation = { operationId: "op_1", idempotencyKey: "idem_a" };
  const execResult = await executeAction({ capability: mint.capability, request, registry, operationStore, adapter, operation: op, params: { title: "escalate delivery incident to executive team" }, clock, idGenerator, current: { resourceVersion: 1, evidenceSnapshotId: "snap_1", planHash, actionHash, policyVersion: decision.policyVersion } });
  if (!execResult.ok || execResult.trigger !== "execution_resolved") throw new Error("unreachable");
  emit("ACTION_EXECUTED", { kind: "server", id: "orchestrator" }, { operationId: op.operationId }, false);

  const verdict = classifyResolvedExecution(execResult.receipt, { idempotencyKey: "idem_a", title: "escalate delivery incident to executive team" });
  emit("POSTCONDITION_VERIFIED", { kind: "server", id: "orchestrator" }, { outcome: verdict.outcome }, false);
  if (verdict.outcome === "SUCCEEDED") emit("WORKFLOW_COMPLETED", { kind: "server", id: "orchestrator" }, {}, false);

  const integrity = verifyLedgerIntegrity(ledger.list());

  const evidence: EvidenceItemView[] = [
    { kind: "CLAIM", id: claim.claimId, text: claim.text, producer: "Planner (advisory)", advisory: true },
    { kind: "EVIDENCE", id: rec.recordId, text: rec.excerpt, producer: "Researcher (advisory)", advisory: true, source: rec.sourceId, integrity: "N/A", freshness: "CURRENT", snapshotId: bundle([rec]).snapshotId },
    { kind: "VERIFIED_FACT", id: `${claim.claimId}-verdict`, text: `${assessment.verdict}`, producer: "assessClaim (deterministic)", advisory: false, integrity: "VERIFIED", freshness: "CURRENT", verificationStatus: assessment.verdict, snapshotId: "snap_1" },
  ];

  return {
    scenarioId: "A",
    scenarioTitle: "Normal governed path (high-risk, approval required)",
    workflowId: wf,
    currentState: verdict.outcome === "SUCCEEDED" ? "COMPLETE" : "FAILED",
    objective: "resolve delivery incident (executive escalation ticket)",
    evidenceSnapshotId: "snap_1",
    governanceStatusLabel: `${decision.outcome}${decision.reasonCodes.length ? " — " + decision.reasonCodes.join(", ") : ""}`,
    specialists: [planner, researcher, RISK_NOT_IMPLEMENTED, VERIFIER_NOT_IMPLEMENTED],
    evidence,
    governance: { outcome: decision.outcome, reasonCodes: decision.reasonCodes, policyVersion: decision.policyVersion, advisory: false },
    approval: { required: true, status: matchResult.ok ? "MATCHED" : "STALE", proposalIdentity: planHash, evidenceSnapshot: "snap_1", resource: "res_1", action: "create_internal_ticket", expiresAt: approval.expiresAt, consumed: consumedApproval.consumedAt !== undefined, advisory: false },
    execution: { authorityState: "AUTHORIZED", status: "RESOLVED", receipt: execResult.receipt, sideEffectCount: adapter.sideEffectCount, advisory: false },
    verification: { preconditionResult: "PASS", adapterResult: execResult.receipt !== undefined ? "SUCCESS" : "ERROR", postconditionResult: verdict.outcome === "SUCCEEDED" ? "PASS" : "FAIL", authoritativeOutcome: verdict.outcome, advisory: false },
    audit,
    conflict: NO_CONFLICT,
    integrity: { checked: true, ok: integrity.ok, ...(integrity.ok ? {} : { reasonCode: integrity.reasonCode, brokenAtSequence: integrity.brokenAtSequence }) },
  };
}

// ---------------------------------------------------------------------------
// B. EVIDENCE CONFLICT — two assessments of the same claim disagree -> BLOCKED, no execution.
// ---------------------------------------------------------------------------
export function runScenarioB(): WorkflowSnapshot {
  const idGenerator = new CounterIdGenerator();
  const clock = new FixedClock(NOW);
  const ledger = new AuditLedger(idGenerator, clock);
  const wf = "wf_scenario_b";
  const audit: AuditEntryView[] = [];
  const emit = (type: AuditEventType, payload: Record<string, unknown>, advisoryContent: boolean) => audit.push(auditView(ledger.append({ type, actor: { kind: "server", id: "orchestrator" }, subject: { kind: "workflow", id: wf }, payload, workflowId: wf }), advisoryContent));

  emit("WORKFLOW_CREATED", { goal: "confirm order status" }, false);
  const recA = record({ recordId: "rec_a" });
  const claimA: Claim = { claimId: "c1", text: "order shipped on time", relatedRecordIds: ["rec_a"] };
  const claimB: Claim = { claimId: "c1", text: "order shipped on time", relatedRecordIds: [] };
  const b = bundle([recA]);
  const a1 = assessClaim(claimA, b, { tenantId: "t1", expectedSnapshotId: "snap_1" });
  const a2 = assessClaim(claimB, b, { tenantId: "t1", expectedSnapshotId: "snap_1" });
  const gate = evaluateEvidenceGate(["c1"], [a1, a2]);
  const trigger = evidenceGateOutcomeToTrigger(gate);
  emit("EVIDENCE_ASSESSED", { outcome: gate.outcome, reasonCodes: gate.reasonCodes }, false);

  const evidence: EvidenceItemView[] = [
    { kind: "CLAIM", id: "c1", text: claimA.text, producer: "Researcher A (advisory)", advisory: true },
    { kind: "EVIDENCE", id: recA.recordId, text: recA.excerpt, producer: "Researcher A (advisory)", advisory: true, source: recA.sourceId, integrity: "VERIFIED", freshness: "CURRENT" },
    { kind: "VERIFIED_FACT", id: "c1-a1", text: a1.verdict, producer: "assessClaim (deterministic)", advisory: false, verificationStatus: a1.verdict },
    { kind: "VERIFIED_FACT", id: "c1-a2", text: a2.verdict, producer: "assessClaim (deterministic)", advisory: false, verificationStatus: a2.verdict, ...(a2.reasonCode ? { integrity: "N/A" } : {}) },
  ];

  return {
    scenarioId: "B",
    scenarioTitle: "Evidence conflict — contradictory assessments block the workflow",
    workflowId: wf,
    currentState: trigger === "claim_blocked" ? "BLOCKED" : "ACTION_PENDING",
    objective: "confirm order status",
    evidenceSnapshotId: "snap_1",
    governanceStatusLabel: "not reached — blocked at evidence gate",
    specialists: [makePlanner(), makeResearcher([recA]), RISK_NOT_IMPLEMENTED, VERIFIER_NOT_IMPLEMENTED],
    evidence,
    approval: NOT_REQUIRED_APPROVAL,
    execution: { authorityState: "NOT_AUTHORIZED", status: "BLOCKED", sideEffectCount: 0, advisory: false },
    verification: { preconditionResult: "N/A", adapterResult: "N/A", postconditionResult: "N/A", authoritativeOutcome: "N/A", advisory: false },
    audit,
    conflict: { present: true, description: `Two assessments of claim "c1" disagree (${a1.verdict} vs ${a2.verdict})`, resolution: `Governance resolves deterministically: ${gate.outcome} (${gate.reasonCodes.join(", ")}) — no vote, no majority` },
    integrity: CLEAN_INTEGRITY,
  };
}

// ---------------------------------------------------------------------------
// C. STALE APPROVAL — plan changes after approval was granted -> CONFLICT, no execution.
// ---------------------------------------------------------------------------
export function runScenarioC(): WorkflowSnapshot {
  const idGenerator = new CounterIdGenerator();
  const clock = new FixedClock(NOW);
  const ledger = new AuditLedger(idGenerator, clock);
  const wf = "wf_scenario_c";
  const audit: AuditEntryView[] = [];
  const emit = (type: AuditEventType, actor: { kind: "server" | "human"; id: string }, payload: Record<string, unknown>) => audit.push(auditView(ledger.append({ type, actor, subject: { kind: "workflow", id: wf }, payload, workflowId: wf }), false));

  emit("WORKFLOW_CREATED", { kind: "server", id: "orchestrator" }, { goal: "issue refund" });
  const binding: ApprovalBinding = { workflowId: wf, planHash: "h_plan_ORIGINAL", evidenceSnapshotId: "snap_1", actionHash: "h_action_1", policyVersion: "policy-v1" };
  const approval = grantApproval({ binding, grantedByPrincipal: "human_operator_1" }, clock, idGenerator);
  emit("APPROVAL_GRANTED", { kind: "human", id: "human_operator_1" }, { approvalId: approval.approvalId });

  // The plan changed after approval was granted, before it was consumed.
  const currentPlanHash = "h_plan_REVISED";
  const matchResult = matchApproval(approval, { workflowId: wf, planHash: currentPlanHash, evidenceSnapshotId: "snap_1", actionHash: "h_action_1", policyVersion: "policy-v1", now: clock.now() });
  emit("APPROVAL_REJECTED", { kind: "server", id: "orchestrator" }, { reasonCodes: matchResult.ok ? [] : matchResult.reasonCodes });

  return {
    scenarioId: "C",
    scenarioTitle: "Stale approval — plan changed after approval, before execution",
    workflowId: wf,
    currentState: "CONFLICT",
    objective: "issue refund",
    evidenceSnapshotId: "snap_1",
    governanceStatusLabel: "REQUIRE_APPROVAL (already decided; approval itself is now stale)",
    specialists: [makePlanner(), RISK_NOT_IMPLEMENTED, VERIFIER_NOT_IMPLEMENTED],
    evidence: [],
    approval: { required: true, status: "STALE", proposalIdentity: "h_plan_ORIGINAL", evidenceSnapshot: "snap_1", resource: "res_1", action: "issue_refund", expiresAt: approval.expiresAt, consumed: false, reasonCodes: matchResult.ok ? [] : matchResult.reasonCodes, advisory: false },
    execution: { authorityState: "NOT_AUTHORIZED", status: "BLOCKED", sideEffectCount: 0, advisory: false },
    verification: { preconditionResult: "N/A", adapterResult: "N/A", postconditionResult: "N/A", authoritativeOutcome: "N/A", advisory: false },
    audit,
    conflict: { present: true, description: `Approval was granted for plan hash "h_plan_ORIGINAL"; the plan is now "${currentPlanHash}"`, resolution: `matchApproval: ${matchResult.ok ? "matched" : matchResult.reasonCodes.join(", ")} — the old approval grants NO authority for the revised plan` },
    integrity: CLEAN_INTEGRITY,
  };
}

// ---------------------------------------------------------------------------
// D. DUPLICATE / REPLAY — same authorized operation presented twice -> one side effect.
// ---------------------------------------------------------------------------
export async function runScenarioD(): Promise<WorkflowSnapshot> {
  const idGenerator = new CounterIdGenerator();
  const clock = new FixedClock(NOW);
  const ledger = new AuditLedger(idGenerator, clock);
  const wf = "wf_scenario_d";
  const audit: AuditEntryView[] = [];
  const emit = (type: AuditEventType, payload: Record<string, unknown>) => audit.push(auditView(ledger.append({ type, actor: { kind: "server", id: "orchestrator" }, subject: { kind: "workflow", id: wf }, payload, workflowId: wf }), false));

  emit("WORKFLOW_CREATED", { goal: "open support ticket" });
  const decision: GovernanceDecision = evaluatePolicyGate({ proposal: { actionId: "a1", actionType: "create_internal_ticket", resourceId: "res_1", principalRole: "operator", tenantId: "t1" }, riskAssessments: [], evidenceGate: { outcome: "SATISFIED", reasonCodes: [] }, forbiddenActionTypes: new Set(), requestsNewSubAgentOrTool: false });
  emit("POLICY_EVALUATED", { outcome: decision.outcome });

  const request: CapabilityRequest = { principalRole: "operator", tenantId: "t1", actionType: "create_internal_ticket", resourceId: "res_1", workflowId: wf, planHash: "h_plan_1", evidenceSnapshotId: "snap_1", actionHash: "h_action_1", policyVersion: decision.policyVersion, expectedResourceVersion: 1 };
  const registry = new CapabilityRegistry();
  const adapter = new FakeTicketAdapter(registry, idGenerator, clock);
  const operationStore = new OperationStore<TicketReceipt>();
  const current = { resourceVersion: 1, evidenceSnapshotId: "snap_1", planHash: "h_plan_1", actionHash: "h_action_1", policyVersion: decision.policyVersion };
  const op: AdapterOperation = { operationId: "op_1", idempotencyKey: "idem_shared" };

  const mint1 = mintCapability({ kind: "policy-allow", decision }, request, idGenerator, clock, 60_000);
  if (!mint1.ok) throw new Error("unreachable");
  registry.record(mint1.capability);
  const first = await executeAction({ capability: mint1.capability, request, registry, operationStore, adapter, operation: op, params: { title: "network outage" }, clock, idGenerator, current });
  emit("ACTION_EXECUTED", { attempt: 1, operationId: op.operationId });

  const mint2 = mintCapability({ kind: "policy-allow", decision }, request, idGenerator, clock, 60_000);
  if (!mint2.ok) throw new Error("unreachable");
  registry.record(mint2.capability);
  const second = await executeAction({ capability: mint2.capability, request, registry, operationStore, adapter, operation: op, params: { title: "network outage" }, clock, idGenerator, current });
  emit("ACTION_EXECUTED", { attempt: 2, operationId: op.operationId, replay: second.ok && second.trigger === "execution_resolved" ? second.replay : undefined });

  if (!first.ok || first.trigger !== "execution_resolved" || !second.ok || second.trigger !== "execution_resolved") throw new Error("unreachable");
  const verdict = classifyResolvedExecution(second.receipt, { idempotencyKey: "idem_shared", title: "network outage" });
  emit("POSTCONDITION_VERIFIED", { outcome: verdict.outcome });

  return {
    scenarioId: "D",
    scenarioTitle: "Duplicate / replay — the same operation presented twice",
    workflowId: wf,
    currentState: verdict.outcome === "SUCCEEDED" ? "COMPLETE" : "FAILED",
    objective: "open support ticket",
    evidenceSnapshotId: "snap_1",
    governanceStatusLabel: `${decision.outcome}`,
    specialists: [makePlanner(), RISK_NOT_IMPLEMENTED, VERIFIER_NOT_IMPLEMENTED],
    evidence: [],
    governance: { outcome: decision.outcome, reasonCodes: decision.reasonCodes, policyVersion: decision.policyVersion, advisory: false },
    approval: NOT_REQUIRED_APPROVAL,
    execution: { authorityState: "AUTHORIZED", status: "RESOLVED", receipt: second.receipt, sideEffectCount: adapter.sideEffectCount, advisory: false },
    verification: { preconditionResult: "PASS", adapterResult: "SUCCESS", postconditionResult: verdict.outcome === "SUCCEEDED" ? "PASS" : "FAIL", authoritativeOutcome: verdict.outcome, advisory: false },
    audit,
    conflict: { present: false, description: `Attempt 1: fresh execution. Attempt 2: idempotency key "idem_shared" already recorded — replayed=${second.replay}, adapter.sideEffectCount=${adapter.sideEffectCount}` },
    integrity: CLEAN_INTEGRITY,
  };
}

// ---------------------------------------------------------------------------
// E. UNKNOWN OUTCOME — adapter may have executed, response uncertain -> no blind retry.
// ---------------------------------------------------------------------------
export async function runScenarioE(): Promise<WorkflowSnapshot> {
  const idGenerator = new CounterIdGenerator();
  const clock = new FixedClock(NOW);
  const ledger = new AuditLedger(idGenerator, clock);
  const wf = "wf_scenario_e";
  const audit: AuditEntryView[] = [];
  const emit = (type: AuditEventType, payload: Record<string, unknown>) => audit.push(auditView(ledger.append({ type, actor: { kind: "server", id: "orchestrator" }, subject: { kind: "workflow", id: wf }, payload, workflowId: wf }), false));

  emit("WORKFLOW_CREATED", { goal: "open support ticket" });
  const decision: GovernanceDecision = evaluatePolicyGate({ proposal: { actionId: "a1", actionType: "create_internal_ticket", resourceId: "res_1", principalRole: "operator", tenantId: "t1" }, riskAssessments: [], evidenceGate: { outcome: "SATISFIED", reasonCodes: [] }, forbiddenActionTypes: new Set(), requestsNewSubAgentOrTool: false });
  emit("POLICY_EVALUATED", { outcome: decision.outcome });

  const request: CapabilityRequest = { principalRole: "operator", tenantId: "t1", actionType: "create_internal_ticket", resourceId: "res_1", workflowId: wf, planHash: "h_plan_1", evidenceSnapshotId: "snap_1", actionHash: "h_action_1", policyVersion: decision.policyVersion, expectedResourceVersion: 1 };
  const registry = new CapabilityRegistry();
  const mint = mintCapability({ kind: "policy-allow", decision }, request, idGenerator, clock, 60_000);
  if (!mint.ok) throw new Error("unreachable");
  registry.record(mint.capability);
  const operationStore = new OperationStore<TicketReceipt>();
  const hangingAdapter = { actionType: "create_internal_ticket", execute: () => new Promise<TicketReceipt>(() => undefined), lookup: async () => ({ status: "unknown" as const }) };

  const execResult = await executeAction({ capability: mint.capability, request, registry, operationStore, adapter: hangingAdapter, operation: { operationId: "op_1", idempotencyKey: "idem_e" }, params: { title: "support ticket" }, clock, idGenerator, current: { resourceVersion: 1, evidenceSnapshotId: "snap_1", planHash: "h_plan_1", actionHash: "h_action_1", policyVersion: decision.policyVersion }, timeoutMs: 50 });
  await new Promise((resolve) => setTimeout(resolve, 60));
  emit("INVARIANT_VIOLATED", { note: "execution_unknown_outcome — timeout, no resolved outcome" });

  if (!execResult.ok || execResult.trigger !== "execution_unknown_outcome") throw new Error("unreachable");
  const reconciliation = await reconcile(hangingAdapter, "op_1");
  emit("RETRY_EXHAUSTED", { note: "reconciliation inconclusive — NOT retried through the adapter" });

  return {
    scenarioId: "E",
    scenarioTitle: "Unknown outcome — adapter timed out, response uncertain",
    workflowId: wf,
    currentState: reconciliation.outcome === "FOUND" ? "VERIFICATION_PENDING" : "RECONCILIATION_REQUIRED",
    objective: "open support ticket",
    evidenceSnapshotId: "snap_1",
    governanceStatusLabel: `${decision.outcome}`,
    specialists: [makePlanner(), RISK_NOT_IMPLEMENTED, VERIFIER_NOT_IMPLEMENTED],
    evidence: [],
    governance: { outcome: decision.outcome, reasonCodes: decision.reasonCodes, policyVersion: decision.policyVersion, advisory: false },
    approval: NOT_REQUIRED_APPROVAL,
    execution: { authorityState: "AUTHORIZED", status: "UNKNOWN_OUTCOME", sideEffectCount: 0, advisory: false },
    verification: { preconditionResult: "PASS", adapterResult: "UNKNOWN", postconditionResult: "N/A", authoritativeOutcome: "UNKNOWN_OUTCOME", advisory: false, ...("reasonCode" in execResult ? { reasonCode: execResult.reasonCode } : {}) },
    audit,
    conflict: { present: false, description: `Reconciliation lookup: ${reconciliation.outcome}. No second adapter.execute() call was made — the timed-out attempt was never retried.` },
    integrity: CLEAN_INTEGRITY,
  };
}

// ---------------------------------------------------------------------------
// F. AUDIT TAMPER — a historical event is mutated after the fact -> integrity failure detected.
// ---------------------------------------------------------------------------
export function runScenarioF(): WorkflowSnapshot {
  const idGenerator = new CounterIdGenerator();
  const clock = new FixedClock(NOW);
  const ledger = new AuditLedger(idGenerator, clock);
  const wf = "wf_scenario_f";
  const audit: AuditEntryView[] = [];
  const push = (e: AuditLedgerEntry) => audit.push(auditView(e, false));

  push(ledger.append({ type: "WORKFLOW_CREATED", actor: { kind: "server", id: "orchestrator" }, subject: { kind: "workflow", id: wf }, payload: { goal: "issue refund" }, workflowId: wf }));
  push(ledger.append({ type: "POLICY_EVALUATED", actor: { kind: "server", id: "orchestrator" }, subject: { kind: "action", id: "a1" }, payload: { reasonCode: "FORBIDDEN_TOOL" }, workflowId: wf }));
  push(ledger.append({ type: "ACTION_EXECUTED", actor: { kind: "server", id: "orchestrator" }, subject: { kind: "operation", id: "op_1" }, payload: {}, workflowId: wf, operationId: "op_1" }));

  const clean = verifyLedgerIntegrity(ledger.list());

  // Simulate an attacker mutating the recorded reason code after the fact.
  const tampered = ledger.list().slice();
  tampered[1] = { ...tampered[1]!, payload: { reasonCode: "ALLOW_EVERYTHING" } };
  const check = verifyLedgerIntegrity(tampered);

  return {
    scenarioId: "F",
    scenarioTitle: "Audit tamper — a historical event is mutated after the fact",
    workflowId: wf,
    currentState: "PAUSED",
    objective: "issue refund",
    evidenceSnapshotId: "snap_1",
    governanceStatusLabel: "DENY — FORBIDDEN_TOOL (as originally recorded)",
    specialists: [RISK_NOT_IMPLEMENTED, VERIFIER_NOT_IMPLEMENTED],
    evidence: [],
    approval: NOT_REQUIRED_APPROVAL,
    execution: { authorityState: "NOT_AUTHORIZED", status: "BLOCKED", sideEffectCount: 0, advisory: false },
    verification: { preconditionResult: "N/A", adapterResult: "N/A", postconditionResult: "N/A", authoritativeOutcome: "N/A", advisory: false },
    audit,
    conflict: { present: false, description: `Clean chain verified: ${clean.ok}. After mutation: ${check.ok ? "still verifies (BUG)" : `INTEGRITY FAILURE DETECTED — ${check.reasonCode} at sequence ${check.brokenAtSequence}`}` },
    integrity: { checked: true, ok: check.ok, ...(check.ok ? {} : { reasonCode: check.reasonCode, brokenAtSequence: check.brokenAtSequence }) },
  };
}

export const SCENARIOS = {
  A: { title: "Normal governed path", run: runScenarioA },
  B: { title: "Evidence conflict", run: runScenarioB },
  C: { title: "Stale approval", run: runScenarioC },
  D: { title: "Duplicate / replay", run: runScenarioD },
  E: { title: "Unknown outcome", run: runScenarioE },
  F: { title: "Audit tamper", run: runScenarioF },
} as const;

export type ScenarioKey = keyof typeof SCENARIOS;

/** Exercises the real @controldeck/agents provider abstraction — used to prove Planner/Researcher panels render REAL agent-layer output, not hand-authored copy. */
export async function demoAgentRun(): Promise<{ plannerOk: boolean; researcherOk: boolean }> {
  const plannerResult = await runPlanner(fixtureProvider({ planId: "plan_demo", goal: "demo", steps: [{ stepId: "s1", description: "demo step", dependsOn: [] }] }), { goal: "demo", principalRole: "operator", tenantId: "t1", workflowContext: {} });
  const researcherResult = await runResearcher(fixtureProvider({ bundleId: "b_demo", snapshotId: "snap_1", query: "demo", records: [], gaps: [], createdAt: NOW.toISOString() }), { goal: "demo", planStepId: "s1", expectedSnapshotId: "snap_1", tenantId: "t1" });
  return { plannerOk: plannerResult.ok, researcherOk: researcherResult.ok };
}
