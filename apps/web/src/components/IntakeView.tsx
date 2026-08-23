import type { WorkflowSnapshot } from "../types.js";
import { Field } from "./Field.js";

export function IntakeView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  return (
    <section className="panel" aria-label="Workflow intake" data-testid="intake-view">
      <h2>1. Workflow Intake</h2>
      <Field label="Workflow ID" value={snapshot.workflowId} />
      <Field label="Current state" value={snapshot.currentState} />
      <Field label="Objective" value={snapshot.objective} />
      <Field label="Evidence snapshot" value={snapshot.evidenceSnapshotId} />
      <Field label="Governance status" value={snapshot.governanceStatusLabel} />
    </section>
  );
}
