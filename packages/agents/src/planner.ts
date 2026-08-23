import { RawPlanArtifact, type PlanArtifact, type SpecialistOutputRejectionReason } from "@controldeck/contracts";
import { callProvider, type SpecialistProvider } from "./provider.js";

/** `AGENT_CONTRACTS.md`: "Goal, principal, workflow context." */
export interface PlannerInput {
  readonly goal: string;
  readonly principalRole: string;
  readonly tenantId: string;
  readonly workflowContext: Readonly<Record<string, unknown>>;
}

/** `AGENT_CONTRACTS.md`: "8s; 1 retry on transport only." Retry policy itself belongs to the orchestrator (Gate 6+, out of scope here) — this is only the per-call budget. */
const PLANNER_TIMEOUT_MS = 8000;

/** Same size-first discipline as ActionHarbor's `parseModelProposal`: reject an oversized payload before ever parsing it. */
const MAX_PLANNER_OUTPUT_BYTES = 64 * 1024;

export type PlannerOutcome = { readonly ok: true; readonly plan: PlanArtifact } | { readonly ok: false; readonly reasonCode: SpecialistOutputRejectionReason; readonly details: string };

/**
 * Runs the Planner provider and validates its raw output against
 * `RawPlanArtifact` before anything downstream may treat it as a plan.
 * Output remains UNTRUSTED until this function returns `ok: true` — even
 * then, "untrusted" only means "structurally a `PlanArtifact`," not
 * "approved" or "evaluated": nothing here decides whether the plan is a
 * good plan, only whether it is even a plan. `AGENT_CONTRACTS.md`'s
 * "invalid output pauses run" is the orchestrator's job to enact (via
 * `retry_budget_exhausted` -> `PAUSED`, `packages/domain/src/state-machine.ts`)
 * once one exists (Gate 6+); this function only ever classifies.
 */
export async function runPlanner(provider: SpecialistProvider<PlannerInput>, input: PlannerInput): Promise<PlannerOutcome> {
  const call = await callProvider(provider, input, PLANNER_TIMEOUT_MS);
  if (!call.ok) {
    return { ok: false, reasonCode: call.reasonCode, details: `planner provider failed: ${call.reasonCode}` };
  }

  const raw = call.raw;
  const serialized = typeof raw === "string" ? raw : (JSON.stringify(raw) ?? "");
  if (Buffer.byteLength(serialized, "utf8") > MAX_PLANNER_OUTPUT_BYTES) {
    return { ok: false, reasonCode: "OVERSIZED_OUTPUT", details: "planner output exceeds size limit" };
  }

  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch (error) {
      return { ok: false, reasonCode: "MALFORMED_JSON", details: error instanceof Error ? error.message : "invalid JSON" };
    }
  }

  const result = RawPlanArtifact.safeParse(candidate);
  if (!result.success) {
    return { ok: false, reasonCode: "SCHEMA_INVALID", details: result.error.message };
  }

  return { ok: true, plan: result.data };
}
