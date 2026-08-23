import type { WorkflowSnapshot } from "../types.js";
import { Badge, Field } from "./Field.js";

const OUTCOME_BADGE = { ALLOW: "allow", DENY: "deny", REQUIRE_APPROVAL: "warn" } as const;

export function GovernanceView({ snapshot }: { readonly snapshot: WorkflowSnapshot }) {
  const g = snapshot.governance;
  return (
    <section className="panel" aria-label="Governance decision" data-testid="governance-view">
      <h2>
        4. Governance Decision <Badge kind="authoritative">Authoritative</Badge>
      </h2>
      {!g && <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>Not reached in this scenario.</p>}
      {g && (
        <>
          <div className="field-row">
            <span className="field-label">Outcome</span>
            <span className="field-value">
              <Badge kind={OUTCOME_BADGE[g.outcome]}>{g.outcome}</Badge>
            </span>
          </div>
          <Field label="Reason code(s)" value={g.reasonCodes.length ? g.reasonCodes.join(", ") : "(none)"} />
          <Field label="Policy version" value={g.policyVersion} />
        </>
      )}
    </section>
  );
}
