import type { WorkflowSnapshot } from "../types.js";
import { Badge, Field } from "./Field.js";

const OUTCOME_BADGE = { SUCCEEDED: "allow", FAILED: "deny", UNKNOWN_OUTCOME: "warn", "N/A": "authoritative" } as const;

export function VerificationView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  const v = snapshot.verification;
  return (
    <section className="panel" aria-label="Verification" data-testid="verification-view">
      <h2>
        7. Verification <Badge kind="authoritative">Authoritative</Badge>
      </h2>
      <Field label="Precondition result" value={v.preconditionResult} />
      <Field label="Adapter result" value={v.adapterResult} />
      <Field label="Postcondition result" value={v.postconditionResult} />
      <div className="field-row">
        <span className="field-label">Authoritative outcome</span>
        <span className="field-value">
          <Badge kind={OUTCOME_BADGE[v.authoritativeOutcome]}>{v.authoritativeOutcome}</Badge>
        </span>
      </div>
      {v.reasonCode && <Field label="Reason code" value={v.reasonCode} />}
    </section>
  );
}
