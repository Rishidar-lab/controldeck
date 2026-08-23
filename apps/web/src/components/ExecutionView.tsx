import type { WorkflowSnapshot } from "../types.js";
import { Badge, Field } from "./Field.js";

const STATUS_BADGE = { NOT_STARTED: "authoritative", EXECUTING: "warn", RESOLVED: "allow", UNKNOWN_OUTCOME: "warn", BLOCKED: "deny" } as const;

export function ExecutionView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  const e = snapshot.execution;
  return (
    <section className="panel" aria-label="Execution" data-testid="execution-view">
      <h2>
        6. Execution <Badge kind="authoritative">Authoritative</Badge>
      </h2>
      <Field label="Authority" value={e.authorityState} />
      <div className="field-row">
        <span className="field-label">Status</span>
        <span className="field-value">
          <Badge kind={STATUS_BADGE[e.status]}>{e.status}</Badge>
        </span>
      </div>
      <Field label="Side effect count" value={e.sideEffectCount} />
      <p className="disclaimer">Success is never inferred from adapter narration text — only a real receipt, re-verified in the Verification panel, counts.</p>
      {e.receipt !== undefined && <pre className="raw-json">{JSON.stringify(e.receipt, null, 2)}</pre>}
    </section>
  );
}
