import type { PlanArtifact } from "@controldeck/contracts";
import { hashCanonical } from "@controldeck/domain";

export function hashPlan(plan: PlanArtifact): string {
  return hashCanonical(plan);
}

/**
 * `AGENT_CONTRACTS.md`'s Executor produces `ActionProposal` for
 * ActionHarbor — a richer type than `@controldeck/governance`'s
 * `ActionProposalSummary` (which governance only needs actionType/
 * resourceId/tenant/principal for). An action actually executed needs
 * PARAMETERS (mirroring ActionHarbor's own `RawAction`), and approval
 * must bind to them too (Gate 5 test 7: "changed parameters rejected") —
 * so this is a disclosed, Gate-5-local extension: the full snapshot a
 * human approves, not the narrower slice governance evaluated.
 */
export interface ActionSnapshot {
  readonly actionId: string;
  readonly actionType: string;
  readonly resourceId: string;
  readonly principalRole: string;
  readonly tenantId: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export function hashAction(action: ActionSnapshot): string {
  return hashCanonical(action);
}
